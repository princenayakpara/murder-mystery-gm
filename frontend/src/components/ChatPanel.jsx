import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';

function messageClass(type) {
  switch (type) {
    case 'gm':
      return 'msg msg-gm';
    case 'event':
      return 'msg msg-event';
    case 'accusation':
      return 'msg msg-accusation';
    case 'system':
      return 'msg msg-system';
    case 'reveal':
      return 'msg msg-reveal';
    default:
      return 'msg msg-chat';
  }
}

function speakerLabel(m) {
  if (m.type === 'gm' || m.type === 'event') return 'Game Master';
  if (m.type === 'system' || m.type === 'reveal') return null;
  return m.authorName;
}

export default function ChatPanel({ transcript, mySlot, avatars = {}, onSend, onAsk, onHint, hideLog = false }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('chat'); // 'chat' | 'ask'
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!hideLog) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length, hideLog]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (mode === 'ask') onAsk(trimmed);
    else onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat-panel">
      {!hideLog && (
        <div className="chat-scroll">
          {transcript.map((m) => {
            const inCharacter = m.authorSlot != null;
            const isAccusation = m.type === 'accusation';
            // Accusation text is third-person ("X accuses Y") — show the accused
            // (targetSlot) in their "under pressure" pose, not the accuser speaking.
            const avatarSlot = isAccusation ? m.targetSlot : m.authorSlot;
            const avatarSet = avatarSlot != null ? avatars[avatarSlot] : null;
            const avatarUrl = avatarSet && (isAccusation ? avatarSet.pressure : avatarSet.neutral);
            return (
              <div key={m.id} className={messageClass(m.type) + (m.authorSlot === mySlot ? ' msg-mine' : '')}>
                {inCharacter && <Avatar src={avatarUrl} name={m.authorName} size={30} className="msg-avatar" />}
                <div className="msg-body">
                  {speakerLabel(m) && <div className="msg-author">{speakerLabel(m)}</div>}
                  <div className="msg-text">{m.text}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
      <form className="chat-input-row" onSubmit={submit}>
        <div className="mode-toggle">
          <button type="button" className={mode === 'chat' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('chat')}>
            Say
          </button>
          <button type="button" className={mode === 'ask' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('ask')}>
            Ask GM
          </button>
          {onHint && (
            <button type="button" className="mode-btn hint-btn" onClick={onHint} title="Get a hint from the Game Master">
              💡 Hint
            </button>
          )}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === 'ask' ? 'Ask the Game Master to inspect something…' : 'Say something to the table…'}
          maxLength={mode === 'ask' ? 500 : 2000}
        />
        <button type="submit" className="primary-btn send-btn" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
