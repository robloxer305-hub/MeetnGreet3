import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../state/auth.jsx';
import { createSocket } from '../lib/socket.js';
import ChatMessage from '../components/ChatMessage.jsx';

export default function RandomChatPage() {
  const auth = useAuth();

  const [status, setStatus] = useState('idle');
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const endRef = useRef(null);

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    const s = createSocket(auth.token);
    socketRef.current = s;

    s.on('connect_error', () => {
      setError('Socket connection failed.');
    });

    s.on('random:queued', () => {
      setStatus('queued');
      setPartner(null);
      setMessages([]);
    });

    s.on('random:matched', (payload) => {
      setStatus('matched');
      setPartner(payload.partner);
      setMessages([]);
    });

    s.on('random:ended', () => {
      setStatus('idle');
      setPartner(null);
      setMessages([]);
    });

    s.on('random:message', (msg) => {
      const from = msg.from;
      setMessages((prev) => [...prev, { ...msg, from }]);
      setTimeout(scrollToBottom, 0);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  function start() {
    setError('');
    socketRef.current?.emit('random:start');
  }

  function next() {
    setError('');
    socketRef.current?.emit('random:next');
  }

  function onSend(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;

    socketRef.current?.emit('random:message', { text: t });
    setText('');
  }

  return (
    <div className="card">
      <div className="form">
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Random chat</h2>
            <div className="small">
              {status === 'idle' ? 'Not connected' : null}
              {status === 'queued' ? 'Looking for someone…' : null}
              {status === 'matched' ? `Connected to ${partner?.displayName || 'someone'}` : null}
            </div>
          </div>

          <div className="row">
            <button className="button" onClick={start} disabled={status === 'queued' || status === 'matched'}>
              Start
            </button>
            <button className="button secondary" onClick={next} disabled={status !== 'matched' && status !== 'queued'}>
              Next
            </button>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ height: 12 }} />

        <div className="card chat">
          <div className="messages">
            {messages.map((m, idx) => (
              <ChatMessage
                key={m.id || `${m.createdAt}-${idx}`}
                msg={{
                  ...m,
                  from: m.from,
                }}
              />
            ))}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={onSend}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={status === 'matched' ? 'Say hi…' : 'Start to chat'} disabled={status !== 'matched'} />
            <button className="button" type="submit" disabled={status !== 'matched'}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
