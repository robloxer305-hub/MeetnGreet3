import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/auth.jsx';

export default function SettingsPage() {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [activeTab, setActiveTab] = useState('privacy');

  const [settings, setSettings] = useState({
    // Privacy Settings
    profileVisibility: 'public',
    showAgeGender: true,
    allowRandomChat: true,
    friendRequestPreference: 'anyone',

    // Notification Settings
    messageNotifications: true,
    friendRequestNotifications: true,
    soundEffects: true,
    desktopNotifications: false,

    // Chat Settings
    theme: 'auto',
    fontSize: 'medium',
    timestampFormat: '12h',
    saveMessageHistory: true,
    autoScroll: true,

    // Appearance Settings
    colorScheme: 'default',
    chatBubbleStyle: 'default',
    avatarSize: 'medium',
  });

  async function loadSettings() {
    setError('');
    setLoading(true);
    try {
      const res = await auth.api.get('/settings');
      setSettings(res.data.settings);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setError('');
    setOk('');
    setSaving(true);
    try {
      const res = await auth.api.put('/settings', settings);
      setOk('Settings saved successfully!');
      
      // Apply theme changes immediately
      applyThemeSettings(settings);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function applyThemeSettings(settings) {
    const root = document.documentElement;
    
    // Apply theme
    if (settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }
    
    // Apply color scheme
    root.setAttribute('data-color-scheme', settings.colorScheme);
    root.setAttribute('data-font-size', settings.fontSize);
    root.setAttribute('data-bubble-style', settings.chatBubbleStyle);
    root.setAttribute('data-avatar-size', settings.avatarSize);
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function resetSettings() {
    setError('');
    setOk('');
    setSaving(true);
    try {
      await auth.api.post('/settings/reset');
      await loadSettings();
      setOk('Settings reset to defaults!');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    // This function would need a proper UI form instead of prompts
    // For now, just log that password change was attempted
    console.log('Password change requested - needs proper UI implementation');
  }

  async function deleteAccount() {
    // This function would need a proper UI confirmation instead of prompt
    // For now, just log that account deletion was attempted
    console.log('Account deletion requested - needs proper UI implementation');
  }

  async function exportData() {
    try {
      const res = await auth.api.get('/auth/export-data');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meetgreet-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setOk('Data exported successfully!');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to export data');
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="form">Loading settings…</div>
      </div>
    );
  }

  const tabs = [
    { id: 'privacy', label: 'Privacy' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'chat', label: 'Chat' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <div className="card">
      <div className="form">
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        
        {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
        {ok && <div className="ok" style={{ marginBottom: 12 }}>{ok}</div>}

        {/* Tab Navigation */}
        <div className="nav" style={{ marginBottom: 20 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'button' : 'button secondary'}
              onClick={() => setActiveTab(tab.id)}
              style={{ fontSize: 13 }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSave}>
          {/* Privacy Settings */}
          {activeTab === 'privacy' && (
            <div>
              <h3>Privacy Settings</h3>
              
              <div style={{ marginBottom: 16 }}>
                <div className="label">Profile Visibility</div>
                <select 
                  className="select" 
                  value={settings.profileVisibility}
                  onChange={(e) => updateSetting('profileVisibility', e.target.value)}
                >
                  <option value="public">Public - Anyone can view</option>
                  <option value="friends">Friends only</option>
                  <option value="private">Private - No one can view</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showAgeGender}
                    onChange={(e) => updateSetting('showAgeGender', e.target.checked)}
                  />
                  Show age and gender on profile
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.allowRandomChat}
                    onChange={(e) => updateSetting('allowRandomChat', e.target.checked)}
                  />
                  Allow random chat matching
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label">Friend Request Preferences</div>
                <select 
                  className="select" 
                  value={settings.friendRequestPreference}
                  onChange={(e) => updateSetting('friendRequestPreference', e.target.value)}
                >
                  <option value="anyone">Anyone can send requests</option>
                  <option value="friends_of_friends">Friends of friends only</option>
                  <option value="no_one">No one can send requests</option>
                </select>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div>
              <h3>Notification Settings</h3>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.messageNotifications}
                    onChange={(e) => updateSetting('messageNotifications', e.target.checked)}
                  />
                  Message notifications
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.friendRequestNotifications}
                    onChange={(e) => updateSetting('friendRequestNotifications', e.target.checked)}
                  />
                  Friend request notifications
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.soundEffects}
                    onChange={(e) => updateSetting('soundEffects', e.target.checked)}
                  />
                  Sound effects
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.desktopNotifications}
                    onChange={(e) => updateSetting('desktopNotifications', e.target.checked)}
                  />
                  Desktop notifications
                </label>
              </div>
            </div>
          )}

          {/* Chat Settings */}
          {activeTab === 'chat' && (
            <div>
              <h3>Chat Settings</h3>
              
              <div style={{ marginBottom: 16 }}>
                <div className="label">Theme</div>
                <select 
                  className="select" 
                  value={settings.theme}
                  onChange={(e) => updateSetting('theme', e.target.value)}
                >
                  <option value="auto">Auto (system preference)</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label">Font Size</div>
                <select 
                  className="select" 
                  value={settings.fontSize}
                  onChange={(e) => updateSetting('fontSize', e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label">Timestamp Format</div>
                <select 
                  className="select" 
                  value={settings.timestampFormat}
                  onChange={(e) => updateSetting('timestampFormat', e.target.value)}
                >
                  <option value="12h">12-hour (AM/PM)</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.saveMessageHistory}
                    onChange={(e) => updateSetting('saveMessageHistory', e.target.checked)}
                  />
                  Save message history
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.autoScroll}
                    onChange={(e) => updateSetting('autoScroll', e.target.checked)}
                  />
                  Auto-scroll to latest message
                </label>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div>
              <h3>Appearance Settings</h3>
              
              <div style={{ marginBottom: 16 }}>
                <div className="label">Color Scheme</div>
                <select 
                  className="select" 
                  value={settings.colorScheme}
                  onChange={(e) => updateSetting('colorScheme', e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="purple">Purple</option>
                  <option value="red">Red</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label">Chat Bubble Style</div>
                <select 
                  className="select" 
                  value={settings.chatBubbleStyle}
                  onChange={(e) => updateSetting('chatBubbleStyle', e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="rounded">Rounded</option>
                  <option value="sharp">Sharp</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label">Avatar Size</div>
                <select 
                  className="select" 
                  value={settings.avatarSize}
                  onChange={(e) => updateSetting('avatarSize', e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          )}

          {/* Account Settings */}
          {activeTab === 'account' && (
            <div>
              <h3>Account Settings</h3>
              
              <div style={{ marginBottom: 16 }}>
                <div className="label">Logged in as</div>
                <div>{auth.user?.email}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <button 
                  type="button" 
                  className="button secondary" 
                  onClick={changePassword}
                  style={{ marginRight: 8 }}
                >
                  Change Password
                </button>
                
                <button 
                  type="button" 
                  className="button secondary" 
                  onClick={exportData}
                  style={{ marginRight: 8 }}
                >
                  Export Data
                </button>
                
                <button 
                  type="button" 
                  className="button danger" 
                  onClick={deleteAccount}
                >
                  Delete Account
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <button 
                  type="button" 
                  className="button secondary" 
                  onClick={resetSettings}
                >
                  Reset All Settings
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <button 
                  type="button" 
                  className="button danger" 
                  onClick={() => auth.logout()}
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div style={{ marginTop: 24 }}>
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
