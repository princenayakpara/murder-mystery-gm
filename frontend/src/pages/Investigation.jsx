import React, { useState } from 'react';
import { useGame } from '../state/GameContext.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import ClueBoard from '../components/ClueBoard.jsx';
import PlayerList from '../components/PlayerList.jsx';
import VotePanel from '../components/VotePanel.jsx';
import VnStage from '../components/vn/VnStage.jsx';

export default function Investigation() {
  const { state, sendChat, askGM, askHint, accuse, castVote, endGame } = useGame();
  const [tab, setTab] = useState('chat');
  const [chatView, setChatView] = useState('scene'); // 'scene' | 'transcript'
  const mySlot = state.character?.player_slot ?? null;

  const panelHidden = (name) => (tab === name ? '' : 'mobile-hidden');

  return (
    <div className="investigation-layout">
      <div className="case-banner">
        <strong>{state.caseTitle}</strong>
        <span className="tag difficulty-badge">{state.difficulty}</span>
        {state.source && state.source !== 'ai' && (
          <span
            className="tag tag-muted"
            title={state.theme ? `Requested "${state.theme}" — using the offline default case instead.` : 'Using the offline default case.'}
          >
            offline demo case
          </span>
        )}
      </div>

      <div className="mobile-tabs">
        <button className={tab === 'chat' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button className={tab === 'clues' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('clues')}>
          Clues ({state.clues.length})
        </button>
        <button className={tab === 'suspects' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('suspects')}>
          Suspects &amp; Vote
        </button>
      </div>

      <div className="investigation-grid">
        <section className={`panel-chat ${panelHidden('chat')}`}>
          <div className="vn-view-toggle">
            <button
              type="button"
              className={chatView === 'scene' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setChatView('scene')}
            >
              Scene
            </button>
            <button
              type="button"
              className={chatView === 'transcript' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setChatView('transcript')}
            >
              Full Transcript
            </button>
          </div>

          {chatView === 'scene' && (
            <VnStage
              transcript={state.transcript}
              avatars={state.avatars}
              roster={state.roster}
              mySlot={mySlot}
              scenes={state.scenes}
            />
          )}

          <ChatPanel
            transcript={state.transcript}
            mySlot={mySlot}
            avatars={state.avatars}
            onSend={sendChat}
            onAsk={askGM}
            onHint={state.difficulty === 'easy' ? askHint : null}
            hideLog={chatView === 'scene'}
          />
        </section>

        <section className={`panel-clues ${panelHidden('clues')}`}>
          <ClueBoard clues={state.clues} />
        </section>

        <section className={`panel-suspects ${panelHidden('suspects')}`}>
          <PlayerList roster={state.roster} mySlot={mySlot} onAccuse={accuse} />
          <VotePanel
            roster={state.roster}
            mySlot={mySlot}
            hasVoted={state.hasVoted}
            voteStatus={state.voteStatus}
            onVote={castVote}
            onEndGame={endGame}
            isHost={state.isHost}
          />
        </section>
      </div>
    </div>
  );
}
