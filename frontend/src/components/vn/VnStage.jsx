import React from 'react';
import SceneLayer from './SceneLayer.jsx';
import PortraitDock from './PortraitDock.jsx';
import DialogueBox from './DialogueBox.jsx';
import RosterStrip from './RosterStrip.jsx';
import { useVnSpeaker } from './useVnSpeaker.js';

/**
 * The primary visual-novel presentation: scene background + roster strip + docked
 * speaker portrait + dialogue box. Entirely derived from state already flowing
 * through the app (transcript, avatars, roster, scenes) — no separate data path.
 */
export default function VnStage({ transcript, avatars, roster, mySlot, scenes }) {
  const speaker = useVnSpeaker(transcript, avatars, roster);
  const sceneKey = speaker.tense ? 'tension' : 'investigation';
  const sceneUrl = scenes[sceneKey] || scenes.investigation;

  return (
    <div className="vn-stage">
      <SceneLayer sceneUrl={sceneUrl}>
        <RosterStrip roster={roster} mySlot={mySlot} activeSlot={speaker.isGM ? null : undefined} />
        <div className="vn-portrait-row">
          <PortraitDock
            name={speaker.speakerName}
            avatarUrl={speaker.avatarUrl}
            side={speaker.side}
            isGM={speaker.isGM}
            pressured={speaker.pressured}
          />
        </div>
        {speaker.text && <DialogueBox speakerName={speaker.speakerName} kind={speaker.kind} text={speaker.text} />}
      </SceneLayer>
    </div>
  );
}
