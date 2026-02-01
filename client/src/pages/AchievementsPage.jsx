import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/auth.jsx';
import { api } from '../lib/api.js';

export default function AchievementsPage() {
  const auth = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
    fetchUserAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const response = await api.get('/api/achievements');
      setAchievements(response.data.achievements);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchUserAchievements = async () => {
    try {
      const response = await api.get(`/api/achievements/user/${auth.user.id}`);
      setUserAchievements(response.data.completedAchievements);
    } catch (error) {
      console.error('Error fetching user achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (badgeColor) => {
    const colors = {
      bronze: 'bg-yellow-600',
      silver: 'bg-gray-400',
      gold: 'bg-yellow-500',
      platinum: 'bg-gray-600',
      diamond: 'bg-blue-600',
    };
    return colors[badgeColor] || 'bg-gray-500';
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'text-gray-600',
      uncommon: 'text-green-600',
      rare: 'text-blue-600',
      epic: 'text-purple-600',
      legendary: 'text-orange-600',
    };
    return colors[rarity] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading achievements...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Achievements</h1>

      {/* User's Achievements */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Achievements</h2>
        <div className="mb-4">
          <div className="text-sm text-gray-600">
            {userAchievements.length} / {achievements.length} Unlocked
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${(userAchievements.length / achievements.length) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userAchievements.map((achievement) => (
            <div key={achievement._id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className={`w-12 h-12 ${getBadgeColor(achievement.badgeColor)} rounded-full flex items-center justify-center text-white text-xl mr-3`}>
                  {achievement.icon || '🏆'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{achievement.name}</h3>
                  <p className={`text-sm ${getRarityColor(achievement.rarity)}`}>{achievement.rarity}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">{achievement.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Unlocked</span>
                <span>{achievement.rewards.experience} XP</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Achievements */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">All Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((achievement) => {
            const isUnlocked = userAchievements.some(ua => ua._id === achievement._id);
            return (
              <div 
                key={achievement._id} 
                className={`border rounded-lg p-4 ${isUnlocked ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
              >
                <div className="flex items-center mb-3">
                  <div className={`w-12 h-12 ${getBadgeColor(achievement.badgeColor)} rounded-full flex items-center justify-center text-white text-xl mr-3 ${isUnlocked ? '' : 'opacity-50'}`}>
                    {achievement.icon || '🏆'}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                      {achievement.name}
                    </h3>
                    <p className={`text-sm ${getRarityColor(achievement.rarity)}`}>{achievement.rarity}</p>
                  </div>
                </div>
                <p className={`text-sm mb-2 ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                  {achievement.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{isUnlocked ? 'Unlocked' : 'Locked'}</span>
                  <span>{achievement.rewards.experience} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
