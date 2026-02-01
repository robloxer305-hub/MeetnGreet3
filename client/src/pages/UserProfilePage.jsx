import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';

export default function UserProfilePage() {
  const { userId } = useParams();
  const auth = useAuth();
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setError('');
    setLoading(true);
    auth.api
      .get(`/profile/${userId}`)
      .then((res) => {
        console.log('Profile API response:', res.data);
        setUser(res.data.profile);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.error || 'Failed to load profile');
        setLoading(false);
      });
  }, [userId]);

  if (loading) {
    return (
      <div className="card">
        <div className="form">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="form">
          <div className="error">{error}</div>
          <button className="button secondary" onClick={() => nav(-1)} style={{ marginTop: 12 }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <UserProfileModal
      user={user}
      onClose={() => nav(-1)}
    />
  );
}
