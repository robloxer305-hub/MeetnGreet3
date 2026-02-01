import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';

export default function GroupInvitePage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  
  console.log('🔧 GroupInvitePage rendered:', { inviteCode, fullParams: useParams() });
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    console.log('🔄 GroupInvitePage useEffect:', { inviteCode });
    if (inviteCode) {
      validateInvite();
    } else {
      console.log('❌ No inviteCode found in URL');
      setError('No invite code found in URL');
      setLoading(false);
    }
  }, [inviteCode]);

  const validateInvite = async () => {
    try {
      // We can't really validate without trying to join, so we'll just show the join button
      setLoading(false);
    } catch (error) {
      console.error('Error validating invite:', error);
      setError('Invalid invite code');
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!auth.user) {
      navigate('/login');
      return;
    }

    console.log('🎯 Joining group with inviteCode:', inviteCode);
    setJoining(true);
    setError('');
    setSuccess('');

    try {
      const url = `/groups/join/${inviteCode}`;
      console.log('📡 Making request to:', url);
      const response = await api.post(url);
      console.log('✅ Join response:', response.data);
      setGroup(response.data.group);
      setSuccess('Successfully joined the group!');
      
      // Navigate to group after a short delay
      setTimeout(() => {
        navigate(`/groups/${response.data.group._id}`);
      }, 2000);
    } catch (error) {
      console.error('❌ Error joining group:', error);
      console.error('❌ Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Loading invite...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
          Group Invitation
        </h1>
        <p style={{ opacity: 0.7, marginBottom: 24 }}>
          You've been invited to join a group!
        </p>
      </div>

      {error && (
        <div style={{
          background: 'var(--danger)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 6,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'var(--success)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 6,
          marginBottom: 16,
        }}>
          {success}
        </div>
      )}

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: 'white',
          fontSize: 24,
          fontWeight: 'bold',
        }}>
          G
        </div>
        
        <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Join Group
        </h2>
        
        <p style={{ opacity: 0.7, fontSize: 14, marginBottom: 20 }}>
          Click below to join this group using the invite code
        </p>
        
        <div style={{
          background: 'var(--background)',
          padding: '12px 16px',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 12,
          marginBottom: 20,
          wordBreak: 'break-all',
        }}>
          {inviteCode}
        </div>

        {!auth.user ? (
          <div>
            <p style={{ marginBottom: 16, opacity: 0.7 }}>
              Please login to join this group
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                width: '100%',
              }}
            >
              Login to Join
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoinGroup}
            disabled={joining || success}
            style={{
              background: joining || success ? 'var(--border)' : 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 6,
              cursor: joining || success ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              width: '100%',
              opacity: joining || success ? 0.7 : 1,
            }}
          >
            {joining ? 'Joining...' : success ? 'Joined!' : 'Join Group'}
          </button>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={() => navigate('/groups')}
          style={{
            background: 'transparent',
            color: 'var(--text)',
            border: 'none',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14,
            opacity: 0.7,
          }}
        >
          Back to Groups
        </button>
      </div>
    </div>
  );
}
