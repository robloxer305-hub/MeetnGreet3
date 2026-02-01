import React, { useState, useEffect } from 'react';
import Avatar from './Avatar.jsx';
import { resolveUrl } from '../lib/url.js';
import { useAuth } from '../state/auth.jsx';

export default function UserProfileModal({ user, onClose }) {
  const [profileData, setProfileData] = useState(user);
  const [loading, setLoading] = useState(false);
  const auth = useAuth();

  useEffect(() => {
    if (!user) return;
    
    // If we already have profile data, no need to fetch
    if (user.age !== undefined || user.gender !== undefined || user.country !== undefined) {
      setProfileData(user);
      return;
    }

    // Fetch complete profile data
    setLoading(true);
    auth.api.get(`/users/${user.id}`)
      .then(res => {
        console.log('Profile API response for user', user.id, ':', res.data);
        if (res.data.user) {
          setProfileData(res.data.user);
        } else {
          console.log('No profile data in response, using original user data');
        }
      })
      .catch(err => {
        console.error('Failed to fetch profile:', err);
        console.error('Error response:', err?.response?.data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, auth.api]);

  if (!profileData) return null;

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
        onClick={onClose}
      >
        <div
          className="card"
          style={{
            padding: 16,
            minWidth: 280,
            maxWidth: 320,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', padding: '20px 0' }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  console.log('UserProfileModal user data:', profileData);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          padding: 16,
          minWidth: 280,
          maxWidth: 320,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Profile</h2>
          <button className="button secondary" onClick={onClose} style={{ padding: '4px 8px', fontSize: 12 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <Avatar src={profileData.avatarUrl} name={profileData.displayName} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{profileData.displayName}</div>
            <div className="small" style={{ marginTop: 4 }}>
              {profileData.age ? `Age: ${profileData.age}` : ''}
              {profileData.age && (profileData.gender || profileData.country) ? ' • ' : ''}
              {profileData.gender ? `Gender: ${profileData.gender}` : ''}
              {profileData.gender && profileData.country ? ' • ' : ''}
              {profileData.country ? `Country: ${profileData.country}` : ''}
            </div>
          </div>
        </div>

        {profileData.about ? (
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ fontSize: 12 }}>About</div>
            <div className="small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
              {profileData.about}
            </div>
          </div>
        ) : null}

        <div className="small" style={{ color: 'var(--muted)', fontSize: 11 }}>
          Public profile view
        </div>
      </div>
    </div>
  );
}
