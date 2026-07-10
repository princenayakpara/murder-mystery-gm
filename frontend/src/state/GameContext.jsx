import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { socket } from '../socket.js';

const SESSION_KEY = 'mm_session';

const initialState = {
  connected: false,
  view: 'home', // 'home' | 'game' | 'past-games'
  roomCode: null,
  playerId: null,
  playerName: null,
  isHost: false,
  status: 'lobby', // 'lobby' | 'briefing' | 'investigating' | 'revealed'
  players: [],
  canStart: false,
  caseTitle: null,
  source: null,
  character: null,
  roster: [],
  transcript: [],
  clues: [],
  briefingReady: { readyCount: 0, total: 0 },
  ready: false,
  voteStatus: { votedCount: 0, totalEligible: 0, votedSlots: [] },
  hasVoted: false,
  reveal: null,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: true };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'ENTER_ROOM':
      return {
        ...state,
        view: 'game',
        roomCode: action.roomCode,
        playerId: action.playerId,
        playerName: action.playerName,
        error: null,
      };
    case 'HYDRATE_STATE':
      return {
        ...state,
        status: action.state.status,
        players: action.state.players,
        transcript: action.state.transcript,
        clues: action.state.clues,
        character: action.state.character ?? state.character,
        roster: action.state.roster?.length ? action.state.roster : state.roster,
        reveal: action.state.reveal ?? state.reveal,
        hasVoted: action.state.hasVoted,
      };
    case 'LOBBY_UPDATE': {
      const me = action.payload.players.find((p) => p.playerId === state.playerId);
      return {
        ...state,
        status: action.payload.status,
        players: action.payload.players,
        canStart: action.payload.canStart,
        isHost: me ? me.isHost : state.isHost,
      };
    }
    case 'GAME_STATUS':
      return {
        ...state,
        status: action.payload.status,
        caseTitle: action.payload.caseTitle ?? state.caseTitle,
        source: action.payload.source ?? state.source,
      };
    case 'SET_CHARACTER':
      return { ...state, character: action.character };
    case 'BRIEFING_UPDATE':
      return { ...state, briefingReady: action.payload };
    case 'MARK_READY':
      return { ...state, ready: true };
    case 'ROSTER_REVEAL':
      return { ...state, roster: action.roster };
    case 'CHAT_MESSAGE':
      return { ...state, transcript: [...state.transcript, action.message] };
    case 'CLUE_NEW':
      return { ...state, clues: [...state.clues, action.clue] };
    case 'VOTE_UPDATE':
      return { ...state, voteStatus: action.payload };
    case 'VOTE_CAST':
      return { ...state, hasVoted: true };
    case 'GAME_REVEAL':
      return { ...state, status: 'revealed', reveal: action.payload };
    case 'RESET':
      return { ...initialState, connected: state.connected, view: 'home' };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    default:
      return state;
  }
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    function onConnect() {
      dispatch({ type: 'CONNECTED' });
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const session = JSON.parse(saved);
          if (session.roomCode && session.playerId) {
            socket.emit(
              'room:join',
              { roomCode: session.roomCode, name: session.name, playerId: session.playerId },
              (res) => {
                if (res.ok) {
                  dispatch({ type: 'ENTER_ROOM', roomCode: res.roomCode, playerId: res.playerId, playerName: session.name });
                  dispatch({ type: 'HYDRATE_STATE', state: res.state });
                  if (res.state.character) dispatch({ type: 'MARK_READY' });
                } else {
                  localStorage.removeItem(SESSION_KEY);
                }
              }
            );
          }
        } catch {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    }
    function onDisconnect() {
      dispatch({ type: 'DISCONNECTED' });
    }
    function onLobbyUpdate(payload) {
      dispatch({ type: 'LOBBY_UPDATE', payload });
    }
    function onGameStatus(payload) {
      dispatch({ type: 'GAME_STATUS', payload });
    }
    function onCharacter(character) {
      dispatch({ type: 'SET_CHARACTER', character });
    }
    function onBriefingUpdate(payload) {
      dispatch({ type: 'BRIEFING_UPDATE', payload });
    }
    function onRosterReveal(roster) {
      dispatch({ type: 'ROSTER_REVEAL', roster });
    }
    function onChatMessage(message) {
      dispatch({ type: 'CHAT_MESSAGE', message });
    }
    function onClueNew(clue) {
      dispatch({ type: 'CLUE_NEW', clue });
    }
    function onVoteUpdate(payload) {
      dispatch({ type: 'VOTE_UPDATE', payload });
    }
    function onGameReveal(payload) {
      dispatch({ type: 'GAME_REVEAL', payload });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lobby:update', onLobbyUpdate);
    socket.on('game:status', onGameStatus);
    socket.on('game:character', onCharacter);
    socket.on('briefing:update', onBriefingUpdate);
    socket.on('roster:reveal', onRosterReveal);
    socket.on('chat:message', onChatMessage);
    socket.on('clue:new', onClueNew);
    socket.on('vote:update', onVoteUpdate);
    socket.on('game:reveal', onGameReveal);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lobby:update', onLobbyUpdate);
      socket.off('game:status', onGameStatus);
      socket.off('game:character', onCharacter);
      socket.off('briefing:update', onBriefingUpdate);
      socket.off('roster:reveal', onRosterReveal);
      socket.off('chat:message', onChatMessage);
      socket.off('clue:new', onClueNew);
      socket.off('vote:update', onVoteUpdate);
      socket.off('game:reveal', onGameReveal);
    };
  }, []);

  const createRoom = useCallback((hostName) => {
    socket.emit('room:create', { hostName }, (res) => {
      if (res.ok) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: res.roomCode, playerId: res.playerId, name: hostName }));
        dispatch({ type: 'ENTER_ROOM', roomCode: res.roomCode, playerId: res.playerId, playerName: hostName });
      } else {
        dispatch({ type: 'SET_ERROR', error: res.error });
      }
    });
  }, []);

  const joinRoom = useCallback((roomCode, name) => {
    socket.emit('room:join', { roomCode: roomCode.toUpperCase(), name }, (res) => {
      if (res.ok) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: res.roomCode, playerId: res.playerId, name }));
        dispatch({ type: 'ENTER_ROOM', roomCode: res.roomCode, playerId: res.playerId, playerName: name });
        dispatch({ type: 'HYDRATE_STATE', state: res.state });
      } else {
        dispatch({ type: 'SET_ERROR', error: res.error });
      }
    });
  }, []);

  const startGame = useCallback((theme) => {
    socket.emit('game:start', { roomCode: stateRef.current.roomCode, theme }, (res) => {
      if (!res.ok) dispatch({ type: 'SET_ERROR', error: res.error });
    });
  }, []);

  const markReady = useCallback(() => {
    socket.emit('briefing:ready', { roomCode: stateRef.current.roomCode });
    dispatch({ type: 'MARK_READY' });
  }, []);

  const sendChat = useCallback((text) => {
    socket.emit('chat:send', { roomCode: stateRef.current.roomCode, text });
  }, []);

  const askGM = useCallback((question) => {
    socket.emit('gm:ask', { roomCode: stateRef.current.roomCode, question });
  }, []);

  const accuse = useCallback((targetSlot) => {
    socket.emit('player:accuse', { roomCode: stateRef.current.roomCode, targetSlot });
  }, []);

  const castVote = useCallback((targetSlot) => {
    socket.emit('player:vote', { roomCode: stateRef.current.roomCode, targetSlot }, (res) => {
      if (res.ok) dispatch({ type: 'VOTE_CAST' });
      else dispatch({ type: 'SET_ERROR', error: res.error });
    });
  }, []);

  const endGame = useCallback(() => {
    socket.emit('game:end', { roomCode: stateRef.current.roomCode }, (res) => {
      if (!res.ok) dispatch({ type: 'SET_ERROR', error: res.error });
    });
  }, []);

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  const startNewGame = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  const setView = useCallback((view) => dispatch({ type: 'SET_VIEW', view }), []);

  const value = {
    state,
    createRoom,
    joinRoom,
    startGame,
    markReady,
    sendChat,
    askGM,
    accuse,
    castVote,
    endGame,
    clearError,
    startNewGame,
    setView,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
