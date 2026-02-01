import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import Avatar from '../components/Avatar.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';

function UserRow({ user, right }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, cursor: 'pointer' }} onClick={() => setShowModal(true)}>
          <Avatar src={user.avatarUrl} name={user.displayName} />
          <div>
            <div style={{ fontWeight: 800 }}>{user.displayName}</div>
            <div className="small">{user.email || ''}</div>
          </div>
        </div>
        <div>{right}</div>
      </div>
      {showModal && (
        <UserProfileModal user={user} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

export default function FriendsPage() {
  const auth = useAuth();

  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  async function loadAll() {
    setError('');
    setOk('');
    try {
      const [f, r] = await Promise.all([auth.api.get('/friends/list'), auth.api.get('/friends/requests')]);
      setFriends(f.data.friends || []);
      setIncoming(r.data.incoming || []);
      setOutgoing(r.data.outgoing || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load friends');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function doSearch() {
    setError('');
    setOk('');
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await auth.api.get(`/friends/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.users || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Search failed');
    }
  }

  async function sendRequest(toUserId) {
    setError('');
    setOk('');
    try {
      await auth.api.post('/friends/request', { toUserId });
      setOk('Request sent.');
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to send request');
    }
  }

  async function accept(requestId) {
    setError('');
    setOk('');
    try {
      await auth.api.post('/friends/accept', { requestId });
      setOk('Friend request accepted.');
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to accept');
    }
  }

  async function reject(requestId) {
    setError('');
    setOk('');
    try {
      await auth.api.post('/friends/reject', { requestId });
      setOk('Request rejected.');
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to reject');
    }
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="form">
          <h2 style={{ marginTop: 0 }}>Friends</h2>

          {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
          {ok ? <div className="ok" style={{ marginBottom: 12 }}>{ok}</div> : null}

          <div className="grid">
            {friends.length === 0 ? <div className="small">No friends yet.</div> : null}
            {friends.map((f) => (
              <UserRow
                key={f.id}
                user={f}
                right={
                  <Link to={`/private/${f.id}`} style={{ textDecoration: 'none' }}>
                    <span className="button secondary">Message</span>
                  </Link>
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="form">
            <h2 style={{ marginTop: 0 }}>Find people</h2>
            <div className="row">
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or display name" />
              <button className="button" onClick={doSearch}>Search</button>
            </div>

            <div style={{ height: 12 }} />

            <div className="grid">
              {searchResults.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  right={
                    friendIds.has(u.id) ? (
                      <span className="badge">Friend</span>
                    ) : (
                      <button className="button secondary" onClick={() => sendRequest(u.id)}>Add</button>
                    )
                  }
                />
              ))}
              {search.trim() && searchResults.length === 0 ? <div className="small">No results.</div> : null}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="form">
            <h2 style={{ marginTop: 0 }}>Requests</h2>

            <div className="grid">
              <div>
                <div className="label">Incoming</div>
                {incoming.length === 0 ? <div className="small">None</div> : null}
                <div className="grid" style={{ marginTop: 8 }}>
                  {incoming.map((r) => (
                    <UserRow
                      key={r.id}
                      user={r.from}
                      right={
                        <div className="row">
                          <button className="button" onClick={() => accept(r.id)}>Accept</button>
                          <button className="button danger" onClick={() => reject(r.id)}>Reject</button>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="label">Outgoing</div>
                {outgoing.length === 0 ? <div className="small">None</div> : null}
                <div className="grid" style={{ marginTop: 8 }}>
                  {outgoing.map((r) => (
                    <UserRow key={r.id} user={r.to} right={<span className="badge">Pending</span>} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
