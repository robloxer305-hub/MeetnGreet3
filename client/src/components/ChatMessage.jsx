import React, { useState } from 'react';
import Avatar from './Avatar.jsx';
import { formatTime } from '../lib/time.js';
import UserProfileModal from './UserProfileModal.jsx';

export default function ChatMessage({ msg }) {
  const userId = msg?.from?.id;
  const displayName = msg?.from?.displayName || 'Unknown';
  const [showModal, setShowModal] = useState(false);

  const profileUser = {
    id: userId,
    displayName,
    avatarUrl: msg?.from?.avatarUrl,
    age: msg?.from?.age,
    country: msg?.from?.country,
    gender: msg?.from?.gender,
    about: msg?.from?.about,
  };

  return (
    <>
      <div className="msg">
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => setShowModal(true)}
        >
          <Avatar src={msg?.from?.avatarUrl} name={displayName} />
        </div>
        <div className="bubble">
          <div className="meta">
            <div className="name">{displayName}</div>
            <div className="time">{formatTime(msg?.createdAt)}</div>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg?.text}</div>
        </div>
      </div>
      {showModal && (
        <UserProfileModal user={profileUser} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
