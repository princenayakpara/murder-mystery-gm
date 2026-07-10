import React, { useState } from 'react';

export default function VotePanel({ roster, mySlot, hasVoted, voteStatus, onVote, onEndGame, isHost }) {
  const [selected, setSelected] = useState(null);
  const votable = roster.filter((c) => c.slot !== mySlot);

  return (
    <div className="vote-panel">
      <h2>Final Vote</h2>
      <p className="muted">
        {voteStatus.votedCount}/{voteStatus.totalEligible} players have voted. Voting is final once everyone has cast a
        vote.
      </p>
      {hasVoted ? (
        <p className="waiting-note">Your vote is locked in. Waiting on the rest of the table…</p>
      ) : (
        <>
          <div className="vote-options">
            {votable.map((c) => (
              <label key={c.slot} className={selected === c.slot ? 'vote-option selected' : 'vote-option'}>
                <input
                  type="radio"
                  name="vote"
                  checked={selected === c.slot}
                  onChange={() => setSelected(c.slot)}
                />
                {c.name}
              </label>
            ))}
          </div>
          <button className="primary-btn" disabled={selected == null} onClick={() => onVote(selected)}>
            Cast Final Vote
          </button>
        </>
      )}
      {isHost && (
        <button className="link-btn danger" onClick={onEndGame}>
          End game now &amp; reveal solution
        </button>
      )}
    </div>
  );
}
