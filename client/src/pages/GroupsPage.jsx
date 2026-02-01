import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';

export default function GroupsPage() {
  const auth = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    isPrivate: false,
    category: 'general',
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      // Only fetch groups where user is a member
      const userId = auth.user?._id || auth.user?.id;
      if (!userId) {
        setGroups([]);
        return;
      }
      
      const response = await api.get(`/groups?userId=${userId}`);
      setGroups(response.data.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      console.log('Creating group:', newGroup);
      
      if (!auth.user || !localStorage.getItem('token')) {
        return;
      }
      
      const response = await api.post('/groups', newGroup);
      console.log('Backend response:', response.data);
      
      // Use the group as returned by backend, but ensure we're marked as member
      const createdGroup = {
        ...response.data.group,
        // Force add current user as member if not already included
        members: response.data.group.members?.length > 0 
          ? response.data.group.members 
          : [{
              user: auth.user._id || auth.user.id,
              joinedAt: new Date(),
              role: 'admin'
            }],
        memberCount: response.data.group.memberCount || 1
      };
      
      console.log('Final group data:', createdGroup);
      setGroups([createdGroup, ...groups]);
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '', isPrivate: false, category: 'general' });
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const navigateToGroup = (groupId) => {
    // Navigate to group chat page
    window.location.href = `/groups/${groupId}`;
  };

  const handleJoinGroup = async (groupId) => {
    try {
      const response = await api.post(`/groups/${groupId}/join`);
      fetchGroups();
    } catch (error) {
      console.error('Error joining group:', error);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      const response = await api.post(`/groups/${groupId}/leave`);
      fetchGroups();
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading groups...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Groups</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Debug info */}
          <div style={{ fontSize: 12, opacity: 0.5 }}>
            Auth: {!!auth.user ? '✅' : '❌'} | Token: {localStorage.getItem('token') ? '✅' : '❌'}
          </div>
          {auth.user && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Create Group
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 18, marginBottom: 16, opacity: 0.7 }}>No groups yet</div>
          {auth.user ? (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Create Your First Group
            </button>
          ) : (
            <div style={{ opacity: 0.7 }}>Please login to create groups</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((group) => (
            <div
              key={group._id}
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => navigateToGroup(group._id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 18,
                    overflow: 'hidden',
                  }}
                >
                  {group.avatarUrl ? (
                    <img
                      src={group.avatarUrl}
                      alt={group.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    group.name?.charAt(0)?.toUpperCase() || 'G'
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                    {group.name}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 8 }}>
                    {group.description || 'No description'}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, opacity: 0.6 }}>
                    <span>{group.category}</span>
                    <span>{group.memberCount || 0} members</span>
                    <span>{group.isPrivate ? 'Private' : 'Public'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {/* Debug info */}
                <div style={{ fontSize: 10, opacity: 0.3 }}>
                  User: {(auth.user?._id || auth.user?.id || 'unknown')?.slice(0, 8)}... | M: {group.members?.length || 0}
                </div>
                
                {(() => {
                  const userId = auth.user?._id || auth.user?.id;
                  const isMember = group.members?.some(m => {
                    const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
                    return memberUserId === userId;
                  });
                  
                  // Check if user is the group creator/admin
                  const isCreator = group.creator === userId || 
                                   group.admins?.some(admin => {
                                     const adminId = typeof admin === 'object' ? admin._id || admin.id : admin;
                                     return adminId === userId;
                                   }) ||
                                   group.members?.some(m => {
                                     const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
                                     return memberUserId === userId && m.role === 'admin';
                                   });
                  
                  return isMember && !isCreator;
                })() && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLeaveGroup(group._id);
                    }}
                    style={{
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Leave
                  </button>
                )}
                
                {(() => {
                  const userId = auth.user?._id || auth.user?.id;
                  const isMember = group.members?.some(m => {
                    const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
                    return memberUserId === userId;
                  });
                  
                  return !isMember;
                })() && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinGroup(group._id);
                    }}
                    style={{
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Join
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 400,
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, margin: 0 }}>
              Create New Group
            </h2>
            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Description
                </label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 14,
                    minHeight: 80,
                    resize: 'vertical',
                  }}
                  rows={3}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Category
                </label>
                <select
                  value={newGroup.category}
                  onChange={(e) => setNewGroup({ ...newGroup, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  <option value="general">General</option>
                  <option value="gaming">Gaming</option>
                  <option value="tech">Tech</option>
                  <option value="music">Music</option>
                  <option value="art">Art</option>
                  <option value="sports">Sports</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newGroup.isPrivate}
                    onChange={(e) => setNewGroup({ ...newGroup, isPrivate: e.target.checked })}
                    style={{ margin: 0 }}
                  />
                  <span style={{ fontWeight: 600 }}>Private Group</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                <button
                  type="submit"
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
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
