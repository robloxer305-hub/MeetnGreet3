import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

const DEFAULT_GROUP_ROOMS = ['general', 'announcements', 'random', 'media'];

export default function GroupChatPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeRoom, setActiveRoom] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [categories, setCategories] = useState([]);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: 'default', // 'default', 'room', 'category'
  });
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  useEffect(() => {
    fetchGroup();
    fetchMessages();
    
    // Auto-scroll to bottom when new messages arrive
    scrollToBottom();
  }, [groupId, activeRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inline editing handlers
  const handleInlineEditRoom = (roomData) => {
    setEditingRoom(roomData);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleInlineEditCategory = (categoryData) => {
    setEditingCategory(categoryData);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const saveRoomEdit = (roomId, categoryId, newName) => {
    if (!newName.trim()) return;
    
    const updatedCategories = categories.map(cat => {
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
    });

    setCategories(updatedCategories);
    localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
    
    // Update active room if this is the current room
    if (activeRoom === editingRoom.roomName) {
      setActiveRoom(newName.trim());
    }
    
    setEditingRoom(null);
  };

  const saveCategoryEdit = (categoryId, newName) => {
    if (!newName.trim()) return;
    
    const updatedCategories = categories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, name: newName.trim() }
        : cat
    );

    setCategories(updatedCategories);
    localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
    setEditingCategory(null);
  };

  const cancelEdit = () => {
    setEditingRoom(null);
    setEditingCategory(null);
  };

  // Context menu handlers
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      
      // Check what was clicked
      const target = e.target;
      let menuType = 'default';
      let clickedData = null;

      // Check if clicked on a room (more specific detection)
      const roomElement = target.closest('[data-room-id]');
      if (roomElement) {
        menuType = 'room';
        clickedData = {
          roomId: roomElement.dataset.roomId,
          roomName: roomElement.dataset.roomName,
          categoryId: roomElement.dataset.categoryId
        };
        console.log('Room clicked:', clickedData);
      }

      // Check if clicked on a category
      const categoryElement = target.closest('[data-category-id]');
      if (categoryElement) {
        menuType = 'category';
        clickedData = {
          categoryId: categoryElement.dataset.categoryId,
          categoryName: categoryElement.dataset.categoryName
        };
        console.log('Category clicked:', clickedData);
      }

      // Check if clicked in rooms sidebar (anywhere in the rooms area)
      const roomsSidebar = target.closest('.card')?.querySelector('.form');
      if (roomsSidebar && !menuType) {
        menuType = 'rooms-sidebar';
      }

      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: menuType,
        data: clickedData
      });
    };

    const handleClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Edit room handler
  const handleEditRoom = (roomData) => {
    const newName = prompt('Edit room name:', roomData.roomName);
    if (newName && newName.trim() && newName !== roomData.roomName) {
      // Update room in categories
      const updatedCategories = categories.map(cat => {
        if (cat.id === roomData.categoryId) {
          return {
            ...cat,
            rooms: cat.rooms.map(room => 
              room.id === roomData.roomId 
                ? { ...room, name: newName.trim() }
                : room
            )
          };
        }
        return cat;
      });

      setCategories(updatedCategories);
      
      // Save to localStorage
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      
      // Update active room if this is the current room
      if (activeRoom === roomData.roomName) {
        setActiveRoom(newName.trim());
      }
      
      console.log('Room updated:', roomData.roomName, '→', newName.trim());
    }
  };

  // Edit category handler
  const handleEditCategory = (categoryData) => {
    const newName = prompt('Edit category name:', categoryData.categoryName);
    if (newName && newName.trim() && newName !== categoryData.categoryName) {
      // Update category in categories
      const updatedCategories = categories.map(cat => 
        cat.id === categoryData.categoryId 
          ? { ...cat, name: newName.trim() }
          : cat
      );

      setCategories(updatedCategories);
      
      // Save to localStorage
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      
      console.log('Category updated:', categoryData.categoryName, '→', newName.trim());
    }
  };

  // Delete room handler
  const handleDeleteRoom = (roomData) => {
    if (confirm(`Delete room "${roomData.roomName}"?`)) {
      const updatedCategories = categories.map(cat => {
        if (cat.id === roomData.categoryId) {
          return {
            ...cat,
            rooms: cat.rooms.filter(room => room.id !== roomData.roomId)
          };
        }
        return cat;
      });

      setCategories(updatedCategories);
      
      // Save to localStorage
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      
      // If this was the active room, switch to first available room
      if (activeRoom === roomData.roomName) {
        let firstRoom = null;
        for (const category of updatedCategories) {
          if (category.rooms.length > 0) {
            firstRoom = category.rooms[0].name;
            break;
          }
        }
        if (firstRoom) {
          setActiveRoom(firstRoom);
        } else {
          setActiveRoom('');
        }
      }
      
      console.log('Room deleted:', roomData.roomName);
    }
  };

  // Delete category handler
  const handleDeleteCategory = (categoryData) => {
    // Find the category in the categories array to get the proper name
    const category = categories.find(cat => cat.id === categoryData.categoryId);
    const categoryName = category?.name || 'Unknown Category';
    
    if (confirm(`Delete category "${categoryName}" and all its rooms?`)) {
      const updatedCategories = categories.filter(cat => cat.id !== categoryData.categoryId);

      setCategories(updatedCategories);
      
      // Save to localStorage
      localStorage.setItem(`group_${groupId}_categories`, JSON.stringify(updatedCategories));
      
      // If active room was in this category, switch to first available room
      let firstRoom = null;
      for (const category of updatedCategories) {
        if (category.rooms.length > 0) {
          firstRoom = category.rooms[0].name;
          break;
        }
      }
      if (firstRoom) {
        setActiveRoom(firstRoom);
      } else {
        setActiveRoom('');
      }
      
      console.log('Category deleted:', categoryName);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        
        // If no active room is set, switch to first available room
        if (!activeRoom) {
          let firstRoom = null;
          for (const category of categoriesData) {
            if (category.rooms.length > 0) {
              firstRoom = category.rooms[0].name;
              break;
            }
          }
          if (firstRoom) {
            setActiveRoom(firstRoom);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching group:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      console.log('Fetching messages for group:', groupId, 'room:', activeRoom);
      const response = await api.get(`/groups/${groupId}/messages?room=${activeRoom}`);
      console.log('Messages response:', response.data);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Try alternative endpoint
      try {
        console.log('Trying alternative messages endpoint...');
        const response = await api.get(`/groups/${groupId}/chat?room=${activeRoom}`);
        console.log('Alternative messages response:', response.data);
        setMessages(response.data.messages || response.data || []);
      } catch (altError) {
        console.error('Alternative messages endpoint failed:', altError);
        // Don't show error on load, just set empty messages
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      console.log('Sending message:', newMessage.trim());
      console.log('Group ID:', groupId);
      console.log('Room:', activeRoom);
      console.log('User ID:', auth.user?._id || auth.user?.id);
      
      const response = await api.post(`/groups/${groupId}/messages`, {
        content: newMessage.trim(),
        type: 'message',
        room: activeRoom
      });
      
      console.log('Message sent response:', response.data);
      
      // Add message to local state immediately for better UX
      const tempMessage = {
        _id: Date.now().toString(),
        content: newMessage.trim(),
        room: activeRoom,
        user: {
          _id: auth.user?._id || auth.user?.id,
          displayName: auth.user.displayName,
          avatarUrl: auth.user.avatarUrl
        },
        createdAt: new Date().toISOString(),
        type: 'message'
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error response:', error.response?.data);
      
      // Try alternative endpoint if main one fails
      try {
        console.log('Trying alternative endpoint...');
        const response = await api.post(`/groups/${groupId}/chat`, {
          message: newMessage.trim(),
          sender: auth.user?._id || auth.user?.id,
          room: activeRoom
        });
        console.log('Alternative response:', response.data);
        
        const tempMessage = {
          _id: Date.now().toString(),
          content: newMessage.trim(),
          room: activeRoom,
          user: {
            _id: auth.user?._id || auth.user?.id,
            displayName: auth.user.displayName,
            avatarUrl: auth.user.avatarUrl
          },
          createdAt: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');
      } catch (altError) {
        console.error('Alternative endpoint also failed:', altError);
      }
    } finally {
      setSending(false);
    }
  };

  const leaveGroup = async () => {
    try {
      await api.post(`/groups/${groupId}/leave`);
      navigate('/groups');
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  };

  const disbandGroup = async () => {
    try {
      await api.delete(`/groups/${groupId}`);
      navigate('/groups');
    } catch (error) {
      console.error('Error disbanding group:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Loading group...</div>
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

  const isMember = group.members?.some(m => {
    const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
    const currentUserId = auth.user?._id || auth.user?.id;
    return memberUserId === currentUserId;
  });

  const isCreator = group.creator === (auth.user?._id || auth.user?.id) || 
                   group.admins?.some(admin => {
                     const adminId = typeof admin === 'object' ? admin._id || admin.id : admin;
                     return adminId === (auth.user?._id || auth.user?.id);
                   }) ||
                   group.members?.some(m => {
                     const memberUserId = typeof m.user === 'object' ? m.user._id || m.user.id : m.user;
                     return memberUserId === (auth.user?._id || auth.user?.id) && m.role === 'admin';
                   });

  return (
    <div className="grid grid-2" style={{ gap: '12px', gridTemplateColumns: '1fr 2fr', height: '100%' }}>
      {/* Group Rooms Sidebar */}
      <div className="card" style={{ height: '100%', overflow: 'hidden' }}>
        <div className="form" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginTop: 0 }}>
            {group?.name || 'Group'} Rooms
          </h2>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            {/* Custom Categories and Rooms */}
            {categories.length > 0 ? (
              <>
                <div className="small" style={{ marginBottom: 8, color: 'var(--muted)' }}>Rooms</div>
                {categories.map((category) => (
                  <div key={category.id} style={{ marginBottom: 12 }}>
                    {/* Category Header */}
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--muted)',
                        marginBottom: 4,
                        paddingLeft: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: editingCategory?.id === category.id ? 'text' : 'pointer',
                      }}
                      data-category-id={category.id}
                      data-category-name={category.name}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleInlineEditCategory(category);
                      }}
                    >
                      {editingCategory?.id === category.id ? (
                        <input
                          type="text"
                          value={editingCategory.tempName || category.name}
                          onChange={(e) => {
                            setEditingCategory(prev => ({ ...prev, tempName: e.target.value }));
                          }}
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
                            padding: '2px 4px',
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
                        <div>{category.name}</div>
                      )}
                    </div>
                    
                    {/* Rooms in Category */}
                    {/* Rooms in Category */}
                    {category.rooms.map((room) => (
                      <div
                        key={room.id}
                        className={`room-item ${activeRoom === room.name ? 'active' : ''}`}
                        onClick={() => {
                          if (!editingRoom || editingRoom.id !== room.id) {
                            setActiveRoom(room.name);
                            setCustomRoom('');
                          }
                        }}
                        data-room-id={room.id}
                        data-room-name={room.name}
                        data-category-id={category.id}
                        style={{
                          padding: '10px 12px',
                          margin: '2px 0',
                          borderRadius: 6,
                          cursor: editingRoom?.id === room.id ? 'text' : 'pointer',
                          background: editingRoom?.id === room.id ? 'rgba(255,255,255,0.1)' : (activeRoom === room.name ? 'var(--accent)' : 'rgba(255,255,255,0.05)'),
                          border: editingRoom?.id === room.id || activeRoom === room.name ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                          transition: 'all 0.2s ease',
                          marginLeft: 8
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleInlineEditRoom(room);
                        }}
                      >
                        {editingRoom?.id === room.id ? (
                          <input
                            type="text"
                            value={editingRoom.tempName || room.name}
                            onChange={(e) => {
                              setEditingRoom(prev => ({ ...prev, tempName: e.target.value }));
                            }}
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
                              padding: '2px 4px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text)',
                              fontSize: 14,
                              outline: 'none',
                              fontFamily: 'inherit',
                            }}
                            autoFocus
                          />
                        ) : (
                          <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 14 }}>{room.name}</div>
                        )}
                      </div>
                    ))}
                    
                    {category.rooms.length === 0 && (
                      <div style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        fontStyle: 'italic',
                        marginLeft: 8,
                        marginBottom: 4
                      }}>
                        No rooms in this category
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: 12,
                padding: '40px 20px',
                fontStyle: 'italic'
              }}>
                No rooms created yet
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  Create rooms in group settings to get started
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/groups')}
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
            <div>
              <h2 style={{ margin: 0 }}>
                {activeRoom ? `${group?.name || 'Group'} - ${activeRoom}` : `${group?.name || 'Group'} - Select a room`}
              </h2>
              <div className="small" style={{ color: 'var(--muted)' }}>
                {group?.memberCount || 0} members • {group?.category}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            {isCreator && (
              <>
                <button
                  onClick={() => navigate(`/groups/${groupId}/rooms`)}
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Manage Rooms
                </button>
                <button
                  onClick={() => navigate(`/groups/${groupId}/settings`)}
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Settings
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete the group "${group?.name}"? This action cannot be undone.`)) {
                      disbandGroup();
                    }
                  }}
                  style={{
                    background: 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Delete Group
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div>Loading messages...</div>
          </div>
        ) : !isMember ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>Join this group to participate in the conversation</div>
            <button
              onClick={() => {
                api.post(`/groups/${groupId}/join`).then(() => {
                  window.location.reload();
                });
              }}
              className="button"
            >
              Join Group
            </button>
          </div>
        ) : !activeRoom ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>Select a room to start chatting</div>
            <button
              onClick={() => navigate(`/groups/${groupId}/settings`)}
              className="button"
            >
              Create Rooms
            </button>
          </div>
        ) : (
          <>
            <div style={{ height: 12 }} />

            <div className="card chat" style={{ margin: '0 16px 16px 16px' }}>
              <div className="messages">
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 50 }}>
                    No messages in {activeRoom} yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        alignSelf: (() => {
                          const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                          const currentUserId = auth.user?._id || auth.user?.id;
                          return messageUserId === currentUserId ? 'flex-end' : 'flex-start';
                        })(),
                        maxWidth: '70%',
                      }}
                    >
                      {(() => {
                        const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                        const currentUserId = auth.user?._id || auth.user?.id;
                        return messageUserId !== currentUserId;
                      })() && (
                        <Avatar
                          src={message.user.avatarUrl}
                          name={message.user.displayName}
                          size={32}
                        />
                      )}
                      <div>
                        <div
                          style={{
                            background: (() => {
                              const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                              const currentUserId = auth.user?._id || auth.user?.id;
                              return messageUserId === currentUserId ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
                            })(),
                            color: (() => {
                              const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                              const currentUserId = auth.user?._id || auth.user?.id;
                              return messageUserId === currentUserId ? 'white' : 'var(--text)';
                            })(),
                            padding: '12px 16px',
                            borderRadius: 18,
                            borderBottomLeftRadius: (() => {
                              const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                              const currentUserId = auth.user?._id || auth.user?.id;
                              return messageUserId === currentUserId ? 18 : 4;
                            })(),
                            borderBottomRightRadius: (() => {
                              const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                              const currentUserId = auth.user?._id || auth.user?.id;
                              return messageUserId === currentUserId ? 4 : 18;
                            })(),
                          }}
                        >
                          {message.content}
                        </div>
                        <div style={{
                          fontSize: 11,
                          opacity: 0.5,
                          marginTop: 4,
                          textAlign: (() => {
                            const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                            const currentUserId = auth.user?._id || auth.user?.id;
                            return messageUserId === currentUserId ? 'right' : 'left';
                          })(),
                        }}>
                          {message.user.displayName} • {new Date(message.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      {(() => {
                        const messageUserId = typeof message.user === 'object' ? message.user._id || message.user.id : message.user;
                        const currentUserId = auth.user?._id || auth.user?.id;
                        return messageUserId === currentUserId;
                      })() && (
                        <Avatar
                          src={message.user.avatarUrl}
                          name={message.user.displayName}
                          size={32}
                        />
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="composer" onSubmit={sendMessage}>
                <input
                  ref={messageInputRef}
                  className="input"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeRoom}...`}
                  disabled={sending}
                />
                <button className="button" type="submit" disabled={!newMessage.trim() || sending}>
                  {sending ? '...' : 'Send'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Context Menu Modal */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            minWidth: '200px',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'room' && (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  handleEditRoom(contextMenu.data);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ✏️ Edit Room
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  console.log('Room settings:', contextMenu.data);
                  // TODO: Navigate to room settings page
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ⚙️ Room Settings
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--danger)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  handleDeleteRoom(contextMenu.data);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                �️ Delete Room
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid var(--border)',
                  marginTop: '4px',
                  paddingTop: '12px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ❌ Cancel
              </div>
            </>
          )}

          {contextMenu.type === 'category' && (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  navigate(`/groups/${groupId}/rooms`);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ⚙️ Manage Rooms
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--danger)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  handleDeleteCategory(contextMenu.data);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                🗑️ Delete Category
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid var(--border)',
                  marginTop: '4px',
                  paddingTop: '12px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ❌ Cancel
              </div>
            </>
          )}

          {contextMenu.type === 'rooms-sidebar' && (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  navigate(`/groups/${groupId}/rooms`);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ⚙️ Manage Rooms
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  navigate(`/groups/${groupId}/settings`);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ⚙️ Group Settings
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  console.log('Refresh rooms');
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                🔄 Refresh
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid var(--border)',
                  marginTop: '4px',
                  paddingTop: '12px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ❌ Cancel
              </div>
            </>
          )}

          {contextMenu.type === 'default' && (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  console.log('Test option 1 clicked');
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                📋 Copy
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  console.log('Test option 2 clicked');
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ⚙️ Settings
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  console.log('Test option 3 clicked');
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                🔄 Refresh
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  console.log('Test option 4 clicked');
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ℹ️ About
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid var(--border)',
                  marginTop: '4px',
                  paddingTop: '12px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                ❌ Cancel
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
