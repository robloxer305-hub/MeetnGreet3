import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import { createSocket } from '../lib/socket.js';
import ChatMessage from '../components/ChatMessage.jsx';

export default function PrivateChatPage() {
  const { friendId } = useParams();
  const auth = useAuth();

  const [friends, setFriends] = useState([]);
  const friend = useMemo(() => friends.find((f) => f.id === friendId), [friends, friendId]);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const endRef = useRef(null);

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadFriends() {
    const res = await auth.api.get('/friends/list');
    setFriends(res.data.friends || []);
  }

  async function loadHistory() {
    setError('');
    try {
      const res = await auth.api.get(`/messages/private/${encodeURIComponent(friendId)}`);
      setMessages(res.data.messages || []);
      setTimeout(scrollToBottom, 0);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load messages');
    }
  }

  useEffect(() => {
    loadFriends().catch(() => {
      setFriends([]);
    });
  }, []);

  useEffect(() => {
    const s = createSocket(auth.token);
    socketRef.current = s;

    s.on('private:message', (msg) => {
      const toId = String(msg.toUserId || '');
      const fromId = String(msg?.from?.id || '');
      if (toId !== String(friendId) && fromId !== String(friendId)) return;
      setMessages((prev) => [...prev, msg]);
      setTimeout(scrollToBottom, 0);
    });


    s.on('connect_error', () => {
      setError('Socket connection failed.');
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [friendId]);

  useEffect(() => {
    loadHistory();
  }, [friendId]);

  function onSend(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    socketRef.current?.emit('private:message', { toUserId: friendId, text: t });
    setText('');
  }


  return (
    <div className="card">
      <div className="form">
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Private chat</h2>
            <div className="small">{friend ? `Talking to ${friend.displayName}` : 'Friend'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/friends" style={{ textDecoration: 'none' }}>
              <span className="button secondary">Back</span>
            </Link>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ height: 12 }} />

        <div className="card chat">
          <div className="messages">
            {messages.map((m) => (
              <ChatMessage key={m.id || m.createdAt} msg={m} />
            ))}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={onSend}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" />
            <button className="button" type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
