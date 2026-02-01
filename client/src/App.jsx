import React, { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import Shell from './components/Shell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './state/auth.jsx';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import PublicChatPage from './pages/PublicChatPage.jsx';
import FriendsPage from './pages/FriendsPage.jsx';
import PrivateChatPage from './pages/PrivateChatPage.jsx';
import RandomChatPage from './pages/RandomChatPage.jsx';
import UserProfilePage from './pages/UserProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import GroupChatPage from './pages/GroupChatPage.jsx';
import GroupSettingsPage from './pages/GroupSettingsPage.jsx';
import GroupRoomsPage from './pages/GroupRoomsPage.jsx';
import GroupInvitePage from './pages/GroupInvitePage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';

export default function App() {
  const auth = useAuth();

  useEffect(() => {
    auth.refreshMe().catch(() => {
      auth.logout();
    });
  }, []);

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to={auth.isAuthed ? '/public' : '/login'} replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/public"
          element={
            <ProtectedRoute>
              <PublicChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/private/:friendId"
          element={
            <ProtectedRoute>
              <PrivateChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/random"
          element={
            <ProtectedRoute>
              <RandomChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/user/:userId"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <GroupChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/groups/:groupId/settings"
          element={
            <ProtectedRoute>
              <GroupSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/groups/:groupId/rooms"
          element={
            <ProtectedRoute>
              <GroupRoomsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/groups/join/:inviteCode"
          element={
            <ProtectedRoute>
              <GroupInvitePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
