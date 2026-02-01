import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';

export default function ExplorePage() {
  const auth = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'other'];

  useEffect(() => {
    fetchPublicGroups();
  }, []);

  const fetchPublicGroups = async () => {
    try {
      const response = await api.get('/groups?isPublic=true&limit=50'); // Get public groups
      setGroups(response.data.groups || []);
    } catch (error) {
      console.error('Error fetching public groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await api.post(`/groups/${groupId}/join`);
      fetchPublicGroups(); // Refresh the list
    } catch (error) {
      console.error('Error joining group:', error);
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || group.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const isUserMember = (group) => {
    const userId = auth.user?._id || auth.user?.id;
    return group.members?.some(m => {
      const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
      return memberUserId === userId;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading groups...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 'bold', margin: 0, marginBottom: 16 }}>Explore Groups</h1>
        <p style={{ opacity: 0.7, marginBottom: 24 }}>Discover public communities to join</p>
        
        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 18, marginBottom: 16, opacity: 0.7 }}>
            {searchTerm || selectedCategory !== 'all' ? 'No groups found matching your criteria' : 'No public groups available'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {filteredGroups.map((group, index) => {
            const userIsMember = isUserMember(group);
            
            return (
              <div
                key={group._id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Group Header */}
                <div style={{
                  padding: 20,
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: 'white',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 24,
                      }}
                    >
                      {group.name?.charAt(0)?.toUpperCase() || 'G'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
                        #{index + 1} {group.name}
                      </div>
                      <div style={{ opacity: 0.9, fontSize: 14 }}>
                        {group.category} • {group.memberCount || 0} members
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group Content */}
                <div style={{ padding: 20 }}>
                  <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 16, minHeight: 40 }}>
                    {group.description || 'No description available'}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {group.tags?.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        style={{
                          background: 'var(--primary)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {group.tags?.length > 3 && (
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        +{group.tags.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    {userIsMember ? (
                      <button
                        onClick={() => window.location.href = `/groups/${group._id}`}
                        style={{
                          flex: 1,
                          background: 'var(--success)',
                          color: 'white',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Enter Group
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinGroup(group._id)}
                        style={{
                          flex: 1,
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Join Group
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
