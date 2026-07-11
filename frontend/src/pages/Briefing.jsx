import React from 'react';
import { useGame } from '../state/GameContext.jsx';
import Avatar from '../components/Avatar.jsx';
import SceneLayer from '../components/vn/SceneLayer.jsx';
import PortraitDock from '../components/vn/PortraitDock.jsx';

export default function Briefing() {
  const { state, markReady } = useGame();
  const c = state.character;

  if (!c) {
    return (
      <div className="page-centered">
        <p>Waiting for your character dossier to arrive…</p>
      </div>
    );
  }

  const usedFallback = state.source && state.source !== 'ai';

  return (
    <div className="page-narrow">
      {state.scenes?.briefing ? (
        <div className="vn-stage vn-stage-briefing">
          <SceneLayer sceneUrl={state.scenes.briefing}>
            <div className="vn-portrait-row">
              <PortraitDock name={c.character_name} avatarUrl={c.avatarUrl} side="right" />
            </div>
          </SceneLayer>
        </div>
      ) : (
        <Avatar src={c.avatarUrl} name={c.character_name} size={96} className="avatar-hero" />
      )}
      <div className="hero briefing-hero">
        <p className="eyebrow">{state.caseTitle}</p>
        <h1>Your Character: {c.character_name}</h1>
      </div>

      {usedFallback && (
        <div className="banner banner-info">
          {state.theme
            ? `You requested a "${state.theme}" case, but the offline default mystery ("Khoon Ki Baraat") is being used instead — the AI Game Master isn't available right now (no API key/credits configured on the server).`
            : `The offline default mystery ("Khoon Ki Baraat") is being used — the AI Game Master isn't available right now (no API key/credits configured on the server).`}
        </div>
      )}

      <div className="card">
        <h2>Public Bio</h2>
        <p>{c.public_bio}</p>
      </div>

      <div className="card card-secret">
        <h2>What only you know</h2>
        <p>{c.private_bio}</p>
      </div>

      <div className="card">
        <h2>Your Objective</h2>
        <p>{c.personal_objective}</p>
      </div>

      <div className="card">
        <h2>Your Alibi (what you tell others)</h2>
        <p>{c.alibi_claimed}</p>
      </div>

      {c.hidden_information?.length > 0 && (
        <div className="card">
          <h2>Things you happen to know</h2>
          <ul>
            {c.hidden_information.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {c.secrets?.length > 0 && (
        <div className="card card-secret">
          <h2>Your Secrets</h2>
          <ul>
            {c.secrets.map((s, i) => (
              <li key={i}>
                {s.content}
                {s.must_not_reveal_unprompted && <span className="tag tag-danger">guard this</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.relationships?.length > 0 && (
        <div className="card">
          <h2>Relationships</h2>
          <ul>
            {c.relationships.map((r, i) => (
              <li key={i}>
                <strong>{r.character}:</strong> {r.relation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="briefing-actions">
        {state.ready ? (
          <p className="waiting-note">
            Ready! Waiting for the rest of the table ({state.briefingReady.readyCount}/{state.briefingReady.total})…
          </p>
        ) : (
          <button className="primary-btn" onClick={markReady}>
            I've studied my character — enter the investigation
          </button>
        )}
      </div>
    </div>
  );
}
