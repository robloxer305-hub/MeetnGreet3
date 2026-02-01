import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

export default function GroupInvites({ groupId, isAdmin }) {
  console.log('🔧 GroupInvites rendered:', { groupId, isAdmin });
  
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [newInvite, setNewInvite] = useState({
    maxUses: 0,
    expiresInDays: 7,
  });

  useEffect(() => {
    console.log('🔄 GroupInvites useEffect:', { groupId, isAdmin });
    if (isAdmin && groupId) {
      fetchInvites();
    } else {
      setLoading(false);
    }
  }, [groupId, isAdmin]);

  const fetchInvites = async () => {
    const url = `/groups/${groupId}/invites`;
    console.log('📡 Fetching invites for group:', groupId);
    console.log('🌐 Full URL will be:', (import.meta.env.VITE_API_BASE_URL || '') + '/api' + url);
    
    try {
      const response = await api.get(url);
      console.log('✅ Full response:', response);
      console.log('✅ Response data:', response.data);
      console.log('✅ Response status:', response.status);
      
      // Check if response is HTML (error case)
      if (typeof response.data === 'string' && response.data.includes('<html')) {
        console.error('❌ Received HTML instead of JSON - routing issue');
        setError('Server error: Invalid response format');
        return;
      }
      
      if (response.data && response.data.invites) {
        console.log('✅ Invites found:', response.data.invites);
        setInvites(response.data.invites);
      } else {
        console.log('✅ No invites found, setting empty array');
        setInvites([]);
      }
    } catch (error) {
      console.error('❌ Error fetching invites:', error);
      console.error('❌ Error response:', error.response?.data);
      setError('Failed to load invites: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async () => {
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post(`/groups/${groupId}/invite`, newInvite);
      
      // Copy invite link to clipboard
      await navigator.clipboard.writeText(response.data.inviteLink);
      
      setSuccess('Invite created and link copied to clipboard!');
      setInvites(prev => [response.data, ...prev]);
      setShowCreateForm(false);
      setNewInvite({ maxUses: 0, expiresInDays: 7 });
    } catch (error) {
      console.error('Error creating invite:', error);
      setError(error.response?.data?.error || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const revokeInvite = async (inviteCode) => {
    try {
      await api.delete(`/groups/${groupId}/invites/${inviteCode}`);
      setInvites(prev => prev.filter(inv => inv.code !== inviteCode));
      setSuccess('Invite revoked successfully');
    } catch (error) {
      console.error('Error revoking invite:', error);
      setError('Failed to revoke invite');
    }
  };

  const copyInviteLink = async (inviteCode) => {
    const inviteLink = `${window.location.origin}/groups/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccess('Invite link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  console.log('🎯 GroupInvites render state:', { isAdmin, loading, invitesLength: invites.length });

  if (!isAdmin) {
    console.log('❌ User is not admin, showing access denied');
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Only group admins can manage invites.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>
          Group Invites
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Create Invite
        </button>
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

      {showCreateForm && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
            Create New Invite
          </h3>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
              Max Uses (0 = unlimited)
            </label>
            <input
              type="number"
              min="0"
              value={newInvite.maxUses}
              onChange={(e) => setNewInvite(prev => ({ ...prev, maxUses: parseInt(e.target.value) || 0 }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--background)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
              Expires In (days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={newInvite.expiresInDays}
              onChange={(e) => setNewInvite(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) || 7 }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--background)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={createInvite}
              disabled={creating}
              style={{
                background: creating ? 'var(--border)' : 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: creating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create Invite'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewInvite({ maxUses: 0, expiresInDays: 7 });
              }}
              style={{
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div>Loading invites...</div>
      ) : invites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, opacity: 0.7 }}>
          <div>No active invites</div>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Create an invite to let people join this group
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {invites.map((invite) => (
            <div
              key={invite.code}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    Invite Code
                  </div>
                  <div style={{
                    background: 'var(--background)',
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    marginBottom: 8,
                    wordBreak: 'break-all',
                  }}>
                    {invite.code}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, display: 'flex', gap: 16 }}>
                    <span>Uses: {invite.uses}/{invite.maxUses === 0 ? '∞' : invite.maxUses}</span>
                    <span>Expires: {formatDate(invite.expiresAt)}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => copyInviteLink(invite.code)}
                    style={{
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => revokeInvite(invite.code)}
                    style={{
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
