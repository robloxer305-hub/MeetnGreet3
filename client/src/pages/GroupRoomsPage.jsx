import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

export default function GroupRoomsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  
  const [group, setGroup] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      setGroup(response.data.group);
      
      // Load categories from localStorage as fallback
      let categoriesData = null;
      
      // Try to get from group.categories first
      if (response.data.group.categories) {
        categoriesData = response.data.group.categories;
        console.log('Found categories in group.categories:', categoriesData);
      }
      // Try to get from localStorage as fallback
      else {
        const localCategories = localStorage.getItem(`group_${groupId}_categories`);
        if (localCategories) {
          try {
            categoriesData = JSON.parse(localCategories);
            console.log('Found categories in localStorage:', categoriesData);
          } catch (e) {
            console.error('Failed to parse localStorage categories:', e);
          }
        }
      }
      
      if (categoriesData) {
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Error fetching group:', error);
      setError('Failed to load group information');
    } finally {
      setLoading(false);
    }
  };

  const saveCategories = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      // Save to backend
      await api.patch(`/groups/${groupId}`, {
        categories: categories
      });
      
      // Save to localStorage as backup
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(categories));
      
      setSuccess('Categories and rooms saved successfully!');
    } catch (error) {
      console.error('Error saving categories:', error);
      setError('Failed to save categories and rooms');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    const newCategory = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      rooms: []
    };

    setCategories([...categories, newCategory]);
    setNewCategoryName('');
  };

  const addRoom = () => {
    if (!newRoomName.trim() || !selectedCategory) {
      setError('Room name and category are required');
      return;
    }

    const newRoom = {
      id: Date.now().toString(),
      name: newRoomName.trim(),
      categoryId: selectedCategory
    };

    setCategories(categories.map(cat => {
      if (cat.id === selectedCategory) {
        return {
          ...cat,
          rooms: [...cat.rooms, newRoom]
        };
      }
      return cat;
    }));

    setNewRoomName('');
    setSelectedCategory('');
  };

  const deleteCategory = (categoryId) => {
    if (confirm('Delete this category and all its rooms?')) {
      setCategories(categories.filter(cat => cat.id !== categoryId));
    }
  };

  const deleteRoom = (categoryId, roomId) => {
    if (confirm('Delete this room?')) {
      setCategories(categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            rooms: cat.rooms.filter(room => room.id !== roomId)
          };
        }
        return cat;
      }));
    }
  };

  const startEditCategory = (category) => {
    setEditingCategory({
      id: category.id,
      tempName: category.name
    });
  };

  const saveCategoryEdit = (categoryId, newName) => {
    if (!newName.trim()) return;
    
    setCategories(categories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, name: newName.trim() }
        : cat
    ));
    setEditingCategory(null);
  };

  const cancelEdit = () => {
    setEditingRoom(null);
    setEditingCategory(null);
  };

  const startEditRoom = (room) => {
    setEditingRoom({
      id: room.id,
      tempName: room.name,
      categoryId: room.categoryId
    });
  };

  const saveRoomEdit = (roomId, categoryId, newName) => {
    if (!newName.trim()) return;
    
    setCategories(categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          rooms: cat.rooms.map(room => 
            room.id === roomId 
              ? { ...room, name: newName.trim() }
              : room
          )
        };
      }
      return cat;
    }));
    setEditingRoom(null);
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Group not found</div>
      </div>
    );
  }

  // Check if user is admin
  const userId = auth.user?._id || auth.user?.id;
  const isAdmin = group.creator === userId || 
                   group.admins?.some(admin => {
                     const adminId = typeof admin === 'object' ? admin._id || admin.id : admin;
                     return adminId === userId;
                   }) ||
                   group.members?.some(m => {
                     const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
                     return memberUserId === userId && m.role === 'admin';
                   });

  if (!isAdmin) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Access denied. Only group admins can manage rooms.</div>
        <button
          onClick={() => navigate(`/groups/${groupId}`)}
          style={{
            marginTop: 16,
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Group
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              fontSize: 20,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>
            {group.name} - Rooms Management
          </h1>
        </div>
        <button
          onClick={saveCategories}
          disabled={saving}
          style={{
            background: saving ? 'var(--muted)' : 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
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

      {/* Create Category Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Create Category
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
              Category Name
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Gaming, Study, Off-topic"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>
          <button
            onClick={addCategory}
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
            Add Category
          </button>
        </div>
      </div>

      {/* Create Room Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Create Room
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
              Room Name
            </label>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g. General Chat, Voice Channel"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 14,
              }}
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={addRoom}
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
            Add Room
          </button>
        </div>
      </div>

      {/* Categories and Rooms List */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Current Categories & Rooms
        </h2>
        
        {categories.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
          }}>
            <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
              No categories created yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Create your first category to start organizing rooms
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {categories.map(category => (
              <div key={category.id} style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                overflow: 'hidden',
              }}>
                {/* Category Header */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    {editingCategory?.id === category.id ? (
                      <input
                        type="text"
                        value={editingCategory.tempName || category.name}
                        onChange={(e) => setEditingCategory(prev => ({ ...prev, tempName: e.target.value }))}
                        onBlur={() => saveCategoryEdit(category.id, editingCategory.tempName || category.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveCategoryEdit(category.id, editingCategory.tempName || category.name);
                          } else if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text)',
                          fontSize: 12,
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                        autoFocus
                      />
                    ) : (
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {category.name}
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      gap: 8,
                    }}>
                      <button
                        onClick={() => startEditCategory(category)}
                        style={{
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          padding: '4px 12px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        style={{
                          background: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          padding: '4px 12px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rooms List */}
                <div style={{ padding: '12px' }}>
                  {category.rooms.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: 12,
                      padding: '20px 0',
                    }}>
                      No rooms in this category
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {category.rooms.map(room => (
                        <div key={room.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                        }}>
                          {editingRoom?.id === room.id ? (
                            <input
                              type="text"
                              value={editingRoom.tempName || room.name}
                              onChange={(e) => setEditingRoom(prev => ({ ...prev, tempName: e.target.value }))}
                              onBlur={() => saveRoomEdit(room.id, room.categoryId, editingRoom.tempName || room.name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveRoomEdit(room.id, room.categoryId, editingRoom.tempName || room.name);
                                } else if (e.key === 'Escape') {
                                  cancelEdit();
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text)',
                                fontSize: 13,
                                outline: 'none',
                                fontFamily: 'inherit',
                              }}
                              autoFocus
                            />
                          ) : (
                            <>
                              <div style={{ fontSize: 13 }}>
                                {room.name}
                              </div>
                              <div style={{
                                fontSize: 11,
                                color: 'var(--muted)',
                                marginTop: 2,
                              }}>
                                {room.id}
                              </div>
                            </>
                          )}
                          <div style={{
                            display: 'flex',
                            gap: 8,
                          }}>
                            <button
                              onClick={() => startEditRoom(room)}
                              style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                padding: '2px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteRoom(category.id, room.id)}
                              style={{
                                background: 'var(--danger)',
                                color: 'white',
                                border: 'none',
                                padding: '2px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
