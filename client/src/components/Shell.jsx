import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';

export default function Shell({ children }) {
  const auth = useAuth();
  const nav = useNavigate();

  return (
    <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="card">
        <div className="header">
          <div className="brand">
            <span>Meet&Greet</span>
          </div>

          <div className="nav">
            {!auth.isAuthed ? (
              <>
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
              </>
            ) : (
              <>
                <Link to="/profile">Profile</Link>
                <Link to="/public">Public Chat</Link>
                <Link to="/friends">Friends</Link>
                <Link to="/random">Random Chat</Link>
                <Link to="/groups">My Groups</Link>
                <Link to="/explore">Explore</Link>
                <Link to="/settings">Settings</Link>
                <button
                  onClick={() => {
                    auth.logout();
                    nav('/login');
                  }}
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
