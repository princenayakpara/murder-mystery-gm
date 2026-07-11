import React from 'react';

const KIND_LABELS = {
  gm: 'Game Master',
  event: 'Game Master',
  reveal: 'Game Master',
};

/** Classic VN-style dialogue box: speaker nameplate + message, docked to the bottom. */
export default function DialogueBox({ speakerName, kind, text }) {
  const label = KIND_LABELS[kind] || speakerName;
  const boxClass = kind === 'accusation' ? 'vn-dialogue-box vn-dialogue-accusation' : 'vn-dialogue-box';

  return (
    <div className={boxClass}>
      {label && <div className="vn-dialogue-name">{label}</div>}
      <div className="vn-dialogue-text">{text}</div>
    </div>
  );
}
