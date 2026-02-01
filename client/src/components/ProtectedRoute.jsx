import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';

export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  if (!auth.isAuthed) return <Navigate to="/login" replace />;
  return children;
}
