import React from 'react';
import { resolveUrl } from '../lib/url.js';

function initials(name) {
  const n = String(name || '').trim();
  if (!n) return 'MG';
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || 'MG';
}

export default function Avatar({ src, name }) {
  if (src) {
    const url = resolveUrl(src);
    return (
      <div className="avatar">
        <img src={url} alt="avatar" />
      </div>
    );
  }

  return (
    <div
      className="avatar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      {initials(name)}
    </div>
  );
}
