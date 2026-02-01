import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../state/auth.jsx';
import Avatar from '../components/Avatar.jsx';

export default function ProfilePage() {
  const auth = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [gender, setGender] = useState('');
  const [about, setAbout] = useState('');

  const avatarUrl = auth.user?.avatarUrl || '';

  const canSave = useMemo(() => displayName.trim().length > 0, [displayName]);

  async function load() {
    setError('');
    setOk('');
    setLoading(true);
    try {
      const res = await auth.api.get('/profile/me');
      const p = res.data.profile;
      setDisplayName(p.displayName || '');
      setAge(p.age === null || p.age === undefined ? '' : String(p.age));
      setCountry(p.country || '');
      setGender(p.gender || '');
      setAbout(p.about || '');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!canSave) {
      setError('Display name is required.');
      return;
    }

    const ageNum = age.trim() ? Number(age.trim()) : null;
    if (age.trim() && (Number.isNaN(ageNum) || ageNum < 13 || ageNum > 120)) {
      setError('Age must be between 13 and 120.');
      return;
    }

    setSaving(true);
    try {
      await auth.api.put('/profile/me', {
        displayName: displayName.trim(),
        age: ageNum,
        country: country.trim(),
        gender: gender.trim(),
        about: about.trim(),
      });
      await auth.refreshMe();
      setOk('Saved.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e) {
    setError('');
    setOk('');
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('avatar', file);

    try {
      const res = await auth.api.post('/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      auth.setSession(auth.token, { ...auth.user, avatarUrl: res.data.avatarUrl });
      setOk('Avatar updated.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Avatar upload failed');
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="form">Loading…</div>
      </div>
    );
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="form">
          <h2 style={{ marginTop: 0 }}>Your profile</h2>

          {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
          {ok ? <div className="ok" style={{ marginBottom: 12 }}>{ok}</div> : null}

          <div className="row" style={{ alignItems: 'center' }}>
            <Avatar src={avatarUrl} name={displayName} />
            <div>
              <div style={{ fontWeight: 800 }}>{displayName || auth.user?.displayName}</div>
              <div className="small">{auth.user?.email}</div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div>
            <div className="label">Profile picture</div>
            <input className="input" type="file" accept="image/*" onChange={onAvatarChange} />
            <div className="small" style={{ marginTop: 6 }}>Max 2MB</div>
          </div>
        </div>
      </div>

      <div className="card">
        <form className="form grid" onSubmit={onSave}>
          <h2 style={{ marginTop: 0 }}>Edit</h2>

          <div>
            <div className="label">Display name</div>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div className="split">
            <div>
              <div className="label">Age</div>
              <input className="input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 21" />
            </div>
            <div>
              <div className="label">Gender</div>
              <input className="input" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="e.g. Female" />
            </div>
          </div>

          <div>
            <div className="label">Country</div>
            <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. USA" />
          </div>

          <div>
            <div className="label">About</div>
            <textarea className="textarea" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Say something about you…" />
          </div>

          <button className="button" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
