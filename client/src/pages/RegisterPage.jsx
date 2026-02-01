import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';

export default function RegisterPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!displayName.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await auth.register(email.trim(), password, displayName.trim());
      nav('/profile');
    } catch (err) {
      setError(err?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="form">
        <h2 style={{ marginTop: 0 }}>Register</h2>

        {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}

        <form onSubmit={onSubmit} className="grid">
          <div>
            <div className="label">Display name</div>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div>
            <div className="label">Password (min 6)</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="button" disabled={loading} type="submit">
            {loading ? 'Creating…' : 'Create account'}
          </button>

          <div className="small">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
