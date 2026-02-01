import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';
import GroupInvites from '../components/GroupInvites.jsx';

export default function GroupSettingsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const fileInputRef = useRef(null);

  // Room management state
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomSuccess, setRoomSuccess] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCategoryDropdown && !event.target.closest('.custom-dropdown')) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  const fetchGroup = async () => {
    try {
      console.log('Fetching group data for:', groupId);
      const response = await api.get(`/groups/${groupId}`);
      console.log('Group response:', response.data);
      console.log('Full group object:', JSON.stringify(response.data.group, null, 2));
      
      setGroup(response.data.group);
      setFormData({
        name: response.data.group.name || '',
        description: response.data.group.description || '',
      });
      setAvatarPreview(response.data.group.avatarUrl || '');
      
      // Load categories and rooms - try multiple sources
      let categoriesData = null;
      
      // Try to get from group.categories
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
      
      console.log('Categories in group:', response.data.group.categories);
      console.log('All group keys:', Object.keys(response.data.group));
      
      if (categoriesData) {
        setCategories(categoriesData);
        console.log('Set categories:', categoriesData);
      } else {
        console.log('No categories found, setting empty array');
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching group:', error);
      setError('Failed to load group information');
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      setRoomError('Category name is required');
      return;
    }

    console.log('Adding category:', newCategoryName.trim());
    console.log('Current categories:', categories);

    try {
      const newCategory = {
        id: Date.now().toString(),
        name: newCategoryName.trim(),
        rooms: []
      };

      const updatedCategories = [...categories, newCategory];
      console.log('Updated categories:', updatedCategories);
      setCategories(updatedCategories);
      
      // Save to localStorage as backup
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      console.log('Saved to localStorage:', updatedCategories);
      
      // Save to backend
      console.log('Saving to backend...');
      const response = await api.patch(`/groups/${groupId}`, {
        categories: updatedCategories
      });
      console.log('Backend response:', response.data);
      console.log('Updated group from backend:', JSON.stringify(response.data.group, null, 2));
      console.log('Categories in updated group:', response.data.group.categories);

      // Update local group state with the response
      if (response.data.group) {
        setGroup(response.data.group);
        if (response.data.group.categories) {
          setCategories(response.data.group.categories);
          // Update localStorage with backend data if available
          localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(response.data.group.categories));
        }
      }

      setNewCategoryName('');
      setRoomSuccess('Category created successfully!');
      setRoomError('');
    } catch (error) {
      console.error('Error creating category:', error);
      console.error('Error response:', error.response?.data);
      setRoomError('Failed to create category: ' + (error.response?.data?.error || error.message));
    }
  };

  const addRoom = async () => {
    if (!newRoomName.trim() || !selectedCategory) {
      setRoomError('Room name and category are required');
      return;
    }

    console.log('Adding room:', newRoomName.trim(), 'to category:', selectedCategory);

    try {
      const newRoom = {
        id: Date.now().toString(),
        name: newRoomName.trim(),
        categoryId: selectedCategory
      };

      const updatedCategories = categories.map(cat => {
        if (cat.id === selectedCategory) {
          return {
            ...cat,
            rooms: [...cat.rooms, newRoom]
          };
        }
        return cat;
      });

      console.log('Updated categories with new room:', updatedCategories);
      setCategories(updatedCategories);
      
      // Save to localStorage as backup
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      console.log('Saved updated categories to localStorage:', updatedCategories);
      
      // Save to backend
      console.log('Saving room to backend...');
      const response = await api.patch(`/groups/${groupId}`, {
        categories: updatedCategories
      });
      console.log('Backend response for room:', response.data);

      // Update local group state with the response
      if (response.data.group) {
        setGroup(response.data.group);
        if (response.data.group.categories) {
          setCategories(response.data.group.categories);
          // Update localStorage with backend data if available
          localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(response.data.group.categories));
        }
      }

      setNewRoomName('');
      setSelectedCategory('');
      setRoomSuccess('Room created successfully!');
      setRoomError('');
    } catch (error) {
      console.error('Error creating room:', error);
      console.error('Error response:', error.response?.data);
      setRoomError('Failed to create room: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      const updatedCategories = categories.filter(cat => cat.id !== categoryId);
      setCategories(updatedCategories);
      
      // Save to localStorage as backup
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      console.log('Saved updated categories to localStorage after delete:', updatedCategories);
      
      // Save to backend
      await api.patch(`/groups/${groupId}`, {
        categories: updatedCategories
      });

      setRoomSuccess('Category deleted successfully!');
    } catch (error) {
      setRoomError('Failed to delete category');
      console.error('Error deleting category:', error);
    }
  };

  const deleteRoom = async (categoryId, roomId) => {
    try {
      const updatedCategories = categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            rooms: cat.rooms.filter(room => room.id !== roomId)
          };
        }
        return cat;
      });

      setCategories(updatedCategories);
      
      // Save to localStorage as backup
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      console.log('Saved updated categories to localStorage after room delete:', updatedCategories);
      
      // Save to backend
      await api.patch(`/groups/${groupId}`, {
        categories: updatedCategories
      });

      setRoomSuccess('Room deleted successfully!');
    } catch (error) {
      setRoomError('Failed to delete room');
      console.error('Error deleting room:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAvatar = async (file) => {
    console.log('🚀 Starting avatar upload:', { fileName: file.name, fileSize: file.size, fileType: file.type });
    
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
      console.log('📤 Sending request to:', `/groups/${groupId}/avatar`);
      const response = await api.post(`/groups/${groupId}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('✅ Avatar upload response:', response.data);
      return response.data.avatarUrl;
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      console.error('❌ Error response:', error.response?.data);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      console.log('🎯 Starting form submission:', { hasAvatarFile: !!avatarFile, formData });
      
      let avatarUrl = group.avatarUrl;

      // Upload new avatar if selected
      if (avatarFile) {
        console.log('📸 Uploading avatar file...');
        avatarUrl = await uploadAvatar(avatarFile);
        console.log('✅ Avatar upload completed, URL length:', avatarUrl?.length);
      }

      // Update group information
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        avatarUrl,
      };

      console.log('📝 Updating group with data:', { ...updateData, avatarUrlLength: avatarUrl?.length });
      
      const response = await api.patch(`/groups/${groupId}`, updateData);
      console.log('✅ Group update response:', response.data);
      
      setSuccess('Group settings updated successfully!');
      setGroup(prev => ({ ...prev, ...updateData }));
      
      // Clear avatar file after successful upload
      setAvatarFile(null);
      
    } catch (error) {
      console.error('Error updating group:', error);
      setError(error.response?.data?.error || 'Failed to update group settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Loading group settings...</div>
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

  // Check if user is admin or creator
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
  const isCreator = group.creator === userId;

  if (!isAdmin) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Access denied. Only group admins can access settings.</div>
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
          }}
        >
          Back to Group
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
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
            Group Settings
          </h1>
        </div>
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

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border)',
        marginBottom: 24,
      }}>
        <button
          onClick={() => setActiveTab('general')}
          style={{
            background: activeTab === 'general' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'general' ? 'white' : 'var(--text)',
            border: 'none',
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'general' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          style={{
            background: activeTab === 'invites' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'invites' ? 'white' : 'var(--text)',
            border: 'none',
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'invites' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          Invites
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          style={{
            background: activeTab === 'rooms' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'rooms' ? 'white' : 'var(--text)',
            border: 'none',
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: 600,
            borderBottom: activeTab === 'rooms' ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          Rooms
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (

      <form onSubmit={handleSubmit}>
        {/* Group Avatar */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 12, fontWeight: 600 }}>
            Group Picture
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: 24,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Group avatar"
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
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
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
                Change Picture
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  style={{
                    background: 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
            JPG, PNG, GIF up to 5MB
          </div>
        </div>

        {/* Group Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Group Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            maxLength={100}
            required
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            {formData.name.length}/100 characters
          </div>
        </div>

        {/* Group Description */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            maxLength={500}
            rows={4}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
              resize: 'vertical',
              minHeight: 100,
            }}
          />
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            {formData.description.length}/500 characters
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate(`/groups/${groupId}`)}
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
      )}

      {activeTab === 'invites' && (
        <GroupInvites groupId={groupId} isAdmin={isAdmin} />
      )}

      {activeTab === 'rooms' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
            Room Management
          </h2>

          {roomError && (
            <div style={{
              background: 'var(--danger)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: 6,
              marginBottom: 16,
            }}>
              {roomError}
            </div>
          )}

          {roomSuccess && (
            <div style={{
              background: 'var(--success)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: 6,
              marginBottom: 16,
            }}>
              {roomSuccess}
            </div>
          )}

          {/* Create Category */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Create Category
            </h3>
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

          {/* Create Room */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Create Room
            </h3>
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
              <div style={{ flex: 1, position: 'relative' }} className="custom-dropdown">
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>
                  Category
                </label>
                <div
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    paddingRight: '30px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 14,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {selectedCategory ? categories.find(cat => cat.id === selectedCategory)?.name || 'Select a category' : 'Select a category'}
                </div>
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '38px',
                  pointerEvents: 'none',
                  color: 'var(--text)',
                  fontSize: '12px',
                  transform: showCategoryDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}>
                  ▼
                </div>
                
                {/* Custom Dropdown Options */}
                {showCategoryDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 14,
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}>
                    <div
                      onClick={() => {
                        setSelectedCategory('');
                        setShowCategoryDropdown(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                      }}
                    >
                      Select a category
                    </div>
                    {categories.map(cat => (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setShowCategoryDropdown(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text)',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                      >
                        {cat.name}
                      </div>
                    ))}
                  </div>
                )}
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
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Current Categories & Rooms
            </h3>
            
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
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.05)',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {category.name}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Delete category "${category.name}" and all its rooms?`)) {
                            deleteCategory(category.id);
                          }
                        }}
                        style={{
                          background: 'var(--danger)',
                          color: 'white',
                          border: 'none',
                          padding: '4px 12px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Delete Category
                      </button>
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
                              <div style={{ fontSize: 13 }}>
                                {room.name}
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete room "${room.name}"?`)) {
                                    deleteRoom(category.id, room.id);
                                  }
                                }}
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
      )}
    </div>
  );
}
