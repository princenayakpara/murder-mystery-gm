import React, { useEffect, useRef, useState } from 'react';

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

export default function ChatPanel({ transcript, mySlot, onSend, onAsk }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('chat'); // 'chat' | 'ask'
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length]);

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
      <div className="chat-scroll">
        {transcript.map((m) => (
          <div key={m.id} className={messageClass(m.type) + (m.authorSlot === mySlot ? ' msg-mine' : '')}>
            {speakerLabel(m) && <div className="msg-author">{speakerLabel(m)}</div>}
            <div className="msg-text">{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={submit}>
        <div className="mode-toggle">
          <button type="button" className={mode === 'chat' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('chat')}>
            Say
          </button>
          <button type="button" className={mode === 'ask' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('ask')}>
            Ask GM
          </button>
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
