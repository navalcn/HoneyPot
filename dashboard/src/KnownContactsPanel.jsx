import React, { useState, useEffect } from 'react';

export default function KnownContactsPanel() {
  const [contacts, setContacts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [senderId, setSenderId]     = useState('');
  const [name, setName]             = useState('');
  const [adding, setAdding]         = useState(false);
  const [feedback, setFeedback]     = useState(null); // { type: 'success'|'error', msg }

  /* ─── Fetch all contacts ─── */
  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/honeypot/contacts');
      if (res.ok) setContacts(await res.json());
    } catch (e) {
      console.error('Error fetching contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  /* ─── Add a contact ─── */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!senderId.trim()) return;
    setAdding(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/honeypot/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: senderId.trim(), name: name.trim() || 'Whitelisted User' })
      });
      const data = await res.json();
      if (res.ok || res.status === 200) {
        setFeedback({ type: 'success', msg: data.message || 'Contact whitelisted successfully.' });
        setSenderId('');
        setName('');
        await fetchContacts();
      } else {
        setFeedback({ type: 'error', msg: data.error || 'Failed to add contact.' });
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Network error. Is the backend running?' });
    } finally {
      setAdding(false);
    }
  };

  /* ─── Delete a contact ─── */
  const handleDelete = async (sid, contactName) => {
    if (!window.confirm(`Remove "${contactName}" (${sid}) from whitelist?`)) return;
    try {
      const res = await fetch(`/api/honeypot/contacts/${sid}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', msg: data.message });
        setContacts(prev => prev.filter(c => c.senderId !== sid));
      } else {
        setFeedback({ type: 'error', msg: data.error || 'Failed to remove contact.' });
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Network error. Is the backend running?' });
    }
  };

  /* ─── Render ─── */
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>🛡️</span>
        <h3 style={{ margin: 0, fontSize: '14px', letterSpacing: '0.08em', color: 'var(--color-text-main)', fontWeight: 700 }}>
          KNOWN CONTACTS WHITELIST
        </h3>
        <span style={{
          marginLeft: 'auto',
          background: 'rgba(34,197,94,0.12)',
          color: '#22c55e',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: '6px',
          padding: '2px 10px',
          fontSize: '11px',
          fontWeight: 600
        }}>
          {contacts.length} Whitelisted
        </span>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 500,
          background: feedback.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: feedback.type === 'success' ? '#22c55e' : '#ef4444',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{feedback.type === 'success' ? '✅ ' : '❌ '}{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px' }}>✕</button>
        </div>
      )}

      {/* Add Contact Form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>
          ADD TO WHITELIST
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            id="contact-sender-id"
            type="text"
            placeholder="Telegram Sender ID (e.g. 6475515542)"
            value={senderId}
            onChange={e => setSenderId(e.target.value)}
            required
            style={{
              flex: '2 1 180px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '9px 14px',
              color: 'var(--color-text-main)',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <input
            id="contact-name"
            type="text"
            placeholder="Display Name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              flex: '1 1 130px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '9px 14px',
              color: 'var(--color-text-main)',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button
            id="add-contact-btn"
            type="submit"
            disabled={adding || !senderId.trim()}
            style={{
              flex: '0 0 auto',
              background: adding || !senderId.trim() ? 'rgba(34,197,94,0.25)' : '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: adding || !senderId.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {adding ? 'Adding...' : '+ Add Contact'}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-color)' }} />

      {/* Contact List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            No whitelisted contacts yet. Add a Telegram Sender ID above to whitelist a friend or family member.
          </div>
        ) : (
          contacts.map((c) => (
            <div
              key={c._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '34px', height: '34px',
                borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', flexShrink: 0
              }}>
                👤
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name || 'Whitelisted User'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  ID: {c.senderId}
                </div>
              </div>

              {/* Badge */}
              <div style={{
                fontSize: '10px', fontWeight: 700,
                padding: '3px 8px', borderRadius: '5px',
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.2)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                ✓ TRUSTED
              </div>

              {/* Delete Button */}
              <button
                id={`delete-contact-${c.senderId}`}
                onClick={() => handleDelete(c.senderId, c.name)}
                title="Remove from whitelist"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  flexShrink: 0,
                  transition: 'background 0.15s'
                }}
              >
                🗑 Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
