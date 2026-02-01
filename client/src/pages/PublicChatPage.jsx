import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../state/auth.jsx';
import { createSocket } from '../lib/socket.js';
import ChatMessage from '../components/ChatMessage.jsx';

const DEFAULT_ROOMS = ['general', 'gaming', 'music', 'study'];

export default function PublicChatPage() {
  const auth = useAuth();

  const [roomId, setRoomId] = useState('general');
  const [customRoom, setCustomRoom] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [roomUsers, setRoomUsers] = useState([]);

  const socketRef = useRef(null);
  const activeRoomRef = useRef('general');
  const endRef = useRef(null);

  const activeRoom = useMemo(() => {
    const r = (customRoom.trim() || roomId || '').trim();
    return r || 'general';
  }, [customRoom, roomId]);

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    const s = createSocket(auth.token);
    socketRef.current = s;

    s.on('connect_error', () => {
      setError('Socket connection failed.');
    });

    s.on('public:message', (msg) => {
      if (String(msg.roomId) !== String(activeRoomRef.current)) return;
      setMessages((prev) => [...prev, msg]);
      setTimeout(scrollToBottom, 0);
    });

    s.on('public:users', (data) => {
      if (String(data.roomId) === String(activeRoomRef.current)) {
        setRoomUsers(data.users || []);
      }
    });

    s.on('public:userJoined', (data) => {
      if (String(data.roomId) === String(activeRoomRef.current)) {
        setRoomUsers(prev => [...prev, data.user]);
      }
    });

    s.on('public:userLeft', (data) => {
      if (String(data.roomId) === String(activeRoomRef.current)) {
        setRoomUsers(prev => prev.filter(u => u.id !== data.userId));
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  async function loadRoomHistory(r) {
    setError('');
    try {
      const res = await auth.api.get(`/messages/public/${encodeURIComponent(r)}`);
      setMessages(res.data.messages || []);
      setTimeout(scrollToBottom, 0);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load messages');
    }
  }

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    activeRoomRef.current = activeRoom;
    s.emit('public:join', { roomId: activeRoom });
    s.emit('public:getUsers', { roomId: activeRoom });
    loadRoomHistory(activeRoom);
  }, [activeRoom]);

  function onSend(e) {
    e.preventDefault();
    setError('');

    const t = text.trim();
    if (!t) return;

    socketRef.current?.emit('public:message', { roomId: activeRoom, text: t });
    setText('');
  }

  return (
    <div className="grid grid-2" style={{ gap: '12px', gridTemplateColumns: '1fr 2fr', height: '100%' }}>
      {/* Room List Sidebar */}
      <div className="card" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="form" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginTop: 0 }}>Rooms</h2>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <div className="small" style={{ marginBottom: 8, color: 'var(--muted)' }}>Popular Rooms</div>
            {DEFAULT_ROOMS.map((r) => (
              <div
                key={r}
                className={`room-item ${activeRoom === r ? 'active' : ''}`}
                onClick={() => {
                  setRoomId(r);
                  setCustomRoom('');
                }}
                style={{
                  padding: '12px',
                  margin: '4px 0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: activeRoom === r ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  border: activeRoom === r ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (activeRoom !== r) {
                    e.target.style.background = 'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeRoom !== r) {
                    e.target.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>#{r}</div>
                <div className="small" style={{ color: 'var(--muted)' }}>
                  {r === 'general' && 'Open discussion for everyone'}
                  {r === 'gaming' && 'Talk about games and gaming'}
                  {r === 'music' && 'Share music and discuss artists'}
                  {r === 'study' && 'Study together and share tips'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 16px' }}>
          <h2 style={{ margin: 0 }}>#{activeRoom}</h2>
          <div className="small" style={{ color: 'var(--muted)' }}>
            {activeRoom === roomId ? 'Default Room' : 'Custom Room'}
          </div>
        </div>

        {error ? <div className="error" style={{ marginBottom: 12, margin: '0 16px 12px 16px' }}>{error}</div> : null}

        <div style={{ height: 12 }} />

        <div className="card chat" style={{ margin: '0 16px 16px 16px' }}>
          <div className="messages">
            {messages.map((m) => (
              <ChatMessage key={m.id || m.createdAt} msg={m} />
            ))}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={onSend}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message #${activeRoom}`} />
            <button className="button" type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
