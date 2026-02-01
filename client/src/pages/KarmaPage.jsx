import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/auth.jsx';

// Mock data for karma
const mockUserKarma = {
  karma: 150,
  level: 5,
  experience: 450,
  achievements: [
    {
      _id: '1',
      name: 'First Steps',
      description: 'Complete your first message',
      icon: '👣',
      badgeColor: 'bronze'
    },
    {
      _id: '2',
      name: 'Social Butterfly',
      description: 'Make 10 friends',
      icon: '🦋',
      badgeColor: 'silver'
    }
  ]
};

const mockLeaderboard = [
  { id: '1', displayName: 'Alice', karma: 500, avatarUrl: '/avatar1.jpg' },
  { id: '2', displayName: 'Bob', karma: 350, avatarUrl: '/avatar2.jpg' },
  { id: '3', displayName: 'Charlie', karma: 250, avatarUrl: '/avatar3.jpg' },
  { id: '4', displayName: 'Diana', karma: 180, avatarUrl: '/avatar4.jpg' },
  { id: '5', displayName: 'Eve', karma: 120, avatarUrl: '/avatar5.jpg' }
];

export default function KarmaPage() {
  const auth = useAuth();
  const [userKarma, setUserKarma] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock data instead of API calls
    setTimeout(() => {
      setUserKarma(mockUserKarma);
      setLeaderboard(mockLeaderboard);
      setLoading(false);
    }, 500); // Simulate loading
  }, []);

  const getReputationLevel = (karma) => {
    if (karma >= 1000) return 'Legendary';
    if (karma >= 500) return 'Master';
    if (karma >= 200) return 'Expert';
    if (karma >= 50) return 'Advanced';
    if (karma >= 10) return 'Intermediate';
    return 'Beginner';
  };

  const getReputationColor = (karma) => {
    if (karma >= 1000) return 'text-purple-600';
    if (karma >= 500) return 'text-blue-600';
    if (karma >= 200) return 'text-green-600';
    if (karma >= 50) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading karma data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Karma & Reputation</h1>

      {/* User's Karma */}
      {userKarma ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Reputation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{userKarma.karma || 0}</div>
              <div className="text-gray-500">Karma Points</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{userKarma.level || 1}</div>
              <div className="text-gray-500">Level</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${getReputationColor(userKarma.karma || 0)}`}>
                {getReputationLevel(userKarma.karma || 0)}
              </div>
              <div className="text-gray-500">Reputation</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progress to next level</span>
              <span className="text-sm text-gray-600">
                {(userKarma.experience || 0) % 100} / 100 XP
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${((userKarma.experience || 0) % 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Reputation</h2>
          <div className="text-center py-8 text-gray-500">
            <div className="text-2xl mb-2">🎯</div>
            <div>Start earning karma by participating in the community!</div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Top Users by Karma</h2>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-2xl mb-2">🏆</div>
            <div>No users on the leaderboard yet. Be the first to earn karma!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((user, index) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    {index + 1}
                  </div>
                  <img
                    src={user.avatarUrl || '/default-avatar.png'}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{user.displayName}</div>
                    <div className={`text-sm ${getReputationColor(user.karma)}`}>
                      {getReputationLevel(user.karma)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{user.karma}</div>
                  <div className="text-sm text-gray-500">Karma</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievement Badges */}
      {userKarma && userKarma.achievements && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Achievement Badges</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {userKarma.achievements.map((achievement) => (
              <div key={achievement._id} className="text-center">
                <div className="text-4xl mb-2">{achievement.icon || '🏆'}</div>
                <div className="text-sm font-medium text-gray-900">{achievement.name}</div>
                <div className="text-xs text-gray-500">{achievement.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
