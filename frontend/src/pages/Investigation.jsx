import React, { useState } from 'react';
import { useGame } from '../state/GameContext.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import ClueBoard from '../components/ClueBoard.jsx';
import PlayerList from '../components/PlayerList.jsx';
import VotePanel from '../components/VotePanel.jsx';

export default function Investigation() {
  const { state, sendChat, askGM, accuse, castVote, endGame } = useGame();
  const [tab, setTab] = useState('chat');
  const mySlot = state.character?.player_slot ?? null;

  const panelHidden = (name) => (tab === name ? '' : 'mobile-hidden');

  return (
    <div className="investigation-layout">
      <div className="case-banner">
        <strong>{state.caseTitle}</strong>
        {state.source && state.source !== 'ai' && <span className="tag tag-muted">offline demo case</span>}
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
          <ChatPanel transcript={state.transcript} mySlot={mySlot} onSend={sendChat} onAsk={askGM} />
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
