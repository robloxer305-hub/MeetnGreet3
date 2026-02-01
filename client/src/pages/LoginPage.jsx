import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';

export default function LoginPage() {
  const auth = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await auth.login(email.trim(), password);
      nav('/public');
    } catch (err) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="form">
        <h2 style={{ marginTop: 0 }}>Login</h2>

        {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}

        <form onSubmit={onSubmit} className="grid">
          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div>
            <div className="label">Password</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="button" disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Login'}
          </button>

          <div className="small">
            No account? <Link to="/register">Register</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
