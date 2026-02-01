import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/auth.jsx';

// Mock data for rooms
const mockRooms = [
  {
    _id: '1',
    name: 'General Discussion',
    description: 'Open chat for everyone',
    category: 'general',
    isPublic: true,
    maxUsers: 100,
    currentUsers: ['user1', 'user2', 'user3']
  },
  {
    _id: '2',
    name: 'Tech Talk',
    description: 'Technology discussions',
    category: 'tech',
    isPublic: true,
    maxUsers: 50,
    currentUsers: ['user1']
  },
  {
    _id: '3',
    name: 'Gaming Hub',
    description: 'Gamers unite!',
    category: 'gaming',
    isPublic: true,
    maxUsers: 75,
    currentUsers: ['user2', 'user3']
  }
];

export default function RoomsPage() {
  const auth = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    description: '',
    isPublic: true,
    category: 'general',
    maxUsers: 100,
  });

  useEffect(() => {
    // Load mock data instead of API call
    setTimeout(() => {
      setRooms(mockRooms);
      setLoading(false);
    }, 500); // Simulate loading
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    // Create new room with mock data
    const newRoomData = {
      _id: Date.now().toString(),
      ...newRoom,
      currentUsers: [auth.user?.id || 'current_user']
    };
    
    setRooms([newRoomData, ...rooms]);
    setShowCreateModal(false);
    setNewRoom({ name: '', description: '', isPublic: true, category: 'general', maxUsers: 100 });
  };

  const handleJoinRoom = (roomId) => {
    // Mock join room functionality
    setRooms(rooms.map(room => {
      if (room._id === roomId) {
        const isAlreadyInRoom = room.currentUsers.includes(auth.user?.id);
        if (!isAlreadyInRoom) {
          return {
            ...room,
            currentUsers: [...room.currentUsers, auth.user?.id || 'current_user']
          };
        }
      }
      return room;
    }));
  };

  const handleLeaveRoom = (roomId) => {
    // Mock leave room functionality
    setRooms(rooms.map(room => {
      if (room._id === roomId) {
        const isInRoom = room.currentUsers.includes(auth.user?.id);
        if (isInRoom) {
          return {
            ...room,
            currentUsers: room.currentUsers.filter(u => u !== auth.user?.id)
          };
        }
      }
      return room;
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading rooms...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chat Rooms</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Room
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <div key={room._id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">{room.name}</h3>
                <p className="text-sm text-gray-500">{room.category}</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4 line-clamp-2">{room.description}</p>
            
            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <span>{room.currentUsers.length} / {room.maxUsers} users</span>
              <span>{room.isPublic ? 'Public' : 'Private'}</span>
            </div>

            <div className="flex gap-2">
              {room.currentUsers.some(u => u.toString() === auth.user?.id) ? (
                <button
                  onClick={() => handleLeaveRoom(room._id)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Leave
                </button>
              ) : (
                <button
                  onClick={() => handleJoinRoom(room._id)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Join
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Room</h2>
            <form onSubmit={handleCreateRoom}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newRoom.category}
                  onChange={(e) => setNewRoom({ ...newRoom, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="gaming">Gaming</option>
                  <option value="tech">Tech</option>
                  <option value="music">Music</option>
                  <option value="art">Art</option>
                  <option value="sports">Sports</option>
                  <option value="education">Education</option>
                  <option value="business">Business</option>
                  <option value="entertainment">Entertainment</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Users
                </label>
                <input
                  type="number"
                  value={newRoom.maxUsers}
                  onChange={(e) => setNewRoom({ ...newRoom, maxUsers: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="2"
                  max="1000"
                />
              </div>

              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newRoom.isPublic}
                    onChange={(e) => setNewRoom({ ...newRoom, isPublic: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Public Room</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Room
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
