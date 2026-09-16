import React, { useState, useEffect } from 'react';

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Fetch alerts from backend
  const fetchAlerts = async (showLoading = false) => {
    if (showLoading) setLoadingAlerts(true);
    try {
      const response = await fetch('/api/honeypot/alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
        setSelectedAttacker(prev => {
          if (!prev && data.length > 0) return data[0];
          // If the currently selected attacker was updated, keep it fresh
          if (prev) {
            const updated = data.find(a => a._id === prev._id || a.senderId === prev.senderId);
            return updated || prev;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      if (showLoading) setLoadingAlerts(false);
    }
  };

  // Fetch conversation transcript by chatId
  const fetchConversation = async (chatId) => {
    setLoadingChat(true);
    try {
      const response = await fetch(`/api/honeypot/conversations/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        setConversation(data);
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
    } finally {
      setLoadingChat(false);
    }
  };

  // Poll alerts every 10 seconds for real-time alerts feel
  useEffect(() => {
    fetchAlerts(true);
    const interval = setInterval(() => fetchAlerts(false), 10000);
    return () => clearInterval(interval);
  }, []);

  // Manual block/unblock action
  const handleToggleBlock = async (senderId, currentBlocked) => {
    try {
      const response = await fetch('/api/honeypot/block-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, block: !currentBlocked })
      });
      if (response.ok) {
        const resData = await response.json();
        setSelectedAttacker(prev => prev ? { ...prev, isBlocked: resData.isBlocked, blockedAttemptsCount: resData.blockedAttemptsCount } : null);
        setAlerts(prev => prev.map(a => a.senderId === senderId ? { ...a, isBlocked: resData.isBlocked, blockedAttemptsCount: resData.blockedAttemptsCount } : a));
      }
    } catch (err) {
      console.error('Error toggling block state:', err);
    }
  };

  // Fetch chat details when selected attacker changes
  useEffect(() => {
    if (selectedAttacker) {
      if (selectedAttacker.associatedChats && selectedAttacker.associatedChats.length > 0) {
        // Fetch the first associated chat transcript
        fetchConversation(selectedAttacker.associatedChats[0]);
      } else {
        setConversation(null);
      }
    }
  }, [selectedAttacker]);

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString();
  };

  return (
    <div className="console-container">
      
      {/* 1. Sidebar Panel: Alerts Feed */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>
            <span className="security-dot-active"></span>
            HONEYPOT ALERT FEED
          </h1>
          <p>Autonomous Threat Intelligence Console</p>
        </div>

        <div className="alerts-list">
          {loadingAlerts && alerts.length === 0 ? (
            <div className="empty-placeholder">Loading threats...</div>
          ) : alerts.length === 0 ? (
            <div className="empty-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              No Scammers Flagged Yet
            </div>
          ) : (
            alerts.map((attacker) => (
              <div 
                key={attacker._id} 
                className={`threat-card scam ${selectedAttacker?._id === attacker._id ? 'active' : ''}`}
                onClick={() => setSelectedAttacker(attacker)}
              >
                <div className="threat-card-header">
                  <div className="threat-name">{attacker.senderName || 'Anonymous Scammer'}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div className="threat-badge scam">Scam</div>
                    {attacker.isBlocked && (
                      <div className="threat-badge" style={{ background: '#ef4444', color: '#fff' }}>🚫 Blocked</div>
                    )}
                  </div>
                </div>
                <div className="threat-meta">
                  <span>ID: {attacker.senderId}</span>
                  {attacker.financialDetails?.upiIds?.length > 0 && (
                    <span style={{ color: 'var(--color-accent-red)' }}>
                      UPI: {attacker.financialDetails.upiIds[0]?.id ?? attacker.financialDetails.upiIds[0]}
                    </span>
                  )}
                  {attacker.links?.length > 0 && (
                    <span style={{ color: 'var(--color-accent-blue)' }}>
                      Link: {attacker.links[0].domain}
                    </span>
                  )}
                </div>
                <div className="threat-time">{formatDate(attacker.updatedAt || attacker.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 2. Main Dashboard & Workspace Section */}
      <main className="main-dashboard">
        
        {/* Top Header Bar */}
        <header className="console-bar">
          <h2>
            SYSTEM LOGS & EXTRACTED THREAT INTEL
          </h2>
          <div className="console-status" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-text-muted)' }}>
            STATUS: ACTIVE MONITORING ({alerts.length} Flagged)
          </div>
        </header>

        {!selectedAttacker ? (
          <div className="empty-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            <p>Select a flagged scammer profile from the feed to inspect threat metadata and dialogue records.</p>
          </div>
        ) : (
          <div className="dashboard-workspace">
            
            {/* Intel Panel: Lists artifacts */}
            <div className="intel-panel">
              
              <div>
                <h3 className="panel-section-title">Attacker Classification & Firewall Status</h3>
                <div className="intel-card" style={{ borderLeft: selectedAttacker.isBlocked ? '4px solid #ef4444' : '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title" style={{ color: selectedAttacker.isBlocked ? 'var(--color-accent-red)' : '#f59e0b' }}>
                      {selectedAttacker.isBlocked ? 'SCAMMER BLOCKED 🚫' : 'SCAM DETECTED • ACTIVE ENGAGEMENT 🟡'}
                    </div>
                    <button 
                      onClick={() => handleToggleBlock(selectedAttacker.senderId, selectedAttacker.isBlocked)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: 'none',
                        background: selectedAttacker.isBlocked ? '#22c55e' : '#ef4444',
                        color: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {selectedAttacker.isBlocked ? 'Unblock Sender 🟢' : 'Enforce Immediate Block 🚫'}
                    </button>
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-text-main)', marginTop: '8px' }}>
                    {selectedAttacker.classificationReasoning || "Threat classified as active financial scamming attempt."}
                  </p>
                  <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div className="console-status" style={{ backgroundColor: 'var(--color-accent-red-glow)', color: 'var(--color-accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      Confidence: {(selectedAttacker.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="console-status" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-text-muted)' }}>
                      Sender ID: {selectedAttacker.senderId}
                    </div>
                    {selectedAttacker.isBlocked && (
                      <div className="console-status" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600 }}>
                        Firewall: {selectedAttacker.blockedAttemptsCount || 0} Inbound Msg Dropped
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="panel-section-title">Flagged Financial Targets</h3>
                <div className="intel-card">
                  
                  {/* UPI IDs */}
                  <div style={{ marginBottom: '16px' }}>
                    <div className="card-title" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>UPI IDs</div>
                    {selectedAttacker.financialDetails?.upiIds?.length > 0 ? (
                      selectedAttacker.financialDetails.upiIds.map((upi, i) => {
                        // Backward-compat: old records may be plain strings
                        const upiId  = upi?.id ?? upi;
                        const isHigh = upi?.confidence === 'high';
                        return (
                          <div key={i} className="threat-tag danger" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{upiId}</span>
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: isHigh ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                              color: isHigh ? '#22c55e' : '#fbbf24',
                              fontWeight: 600
                            }}>
                              {isHigh ? '✓ verified' : '~ possible'}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>No UPI IDs captured.</p>
                    )}
                  </div>

                  {/* Bank Accounts */}
                  <div style={{ marginBottom: '16px' }}>
                    <div className="card-title" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Bank Accounts</div>
                    {selectedAttacker.financialDetails?.bankAccounts?.length > 0 ? (
                      selectedAttacker.financialDetails.bankAccounts.map((acc, i) => (
                        <div key={i} className="threat-tag info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                          <span style={{ fontWeight: '600' }}>Acc: {acc.accountNumber}</span>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>IFSC: {acc.ifsc} | Bank: {acc.bankName}</span>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>No bank accounts captured.</p>
                    )}
                  </div>

                  {/* Cards */}
                  <div>
                    <div className="card-title" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Cards</div>
                    {selectedAttacker.financialDetails?.cards?.length > 0 ? (
                      selectedAttacker.financialDetails.cards.map((card, i) => (
                        <div key={i} className="threat-tag danger">{card}</div>
                      ))
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>No card details captured.</p>
                    )}
                  </div>

                </div>
              </div>

              <div>
                <h3 className="panel-section-title">Flagged Domains & Links</h3>
                <div className="intel-card">
                  {selectedAttacker.links?.length > 0 ? (
                    selectedAttacker.links.map((link, i) => (
                      <div key={i} className="link-item">
                        <a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a>
                        <span className="link-domain">{link.domain}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>No URLs captured.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="panel-section-title">Attacker Contact Identifiers</h3>
                <div className="intel-card">
                  
                  {/* Phone Numbers */}
                  <div style={{ marginBottom: '16px' }}>
                    <div className="card-title" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Phone Numbers</div>
                    {selectedAttacker.attackerIdentifiers?.phoneNumbers?.length > 0 ? (
                      selectedAttacker.attackerIdentifiers.phoneNumbers.map((phone, i) => (
                        <div key={i} className="threat-tag danger">{phone}</div>
                      ))
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>No phone numbers captured.</p>
                    )}
                  </div>

                  {/* Handles */}
                  <div>
                    <div className="card-title" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Handles & Usernames</div>
                    {selectedAttacker.attackerIdentifiers?.handles?.length > 0 ? (
                      selectedAttacker.attackerIdentifiers.handles.map((handle, i) => (
                        <div key={i} className="threat-tag danger">{handle}</div>
                      ))
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-dark)' }}>No social handles captured.</p>
                    )}
                  </div>

                </div>
              </div>

            </div>

            {/* Chat Panel: Multi-turn Dialogue Transcript */}
            <div className="chat-panel">
              <div className="chat-header">
                <span>CONVERSATION LOG (chatId: {selectedAttacker.associatedChats?.[0] || 'N/A'})</span>
                <span style={{ color: 'var(--color-accent-blue)' }}>Kamla Devi Persona Activated</span>
              </div>

              <div className="chat-history">
                {loadingChat ? (
                  <div className="empty-placeholder">Loading transcript...</div>
                ) : !conversation ? (
                  <div className="empty-placeholder">No conversation log found.</div>
                ) : (
                  conversation.turns.map((turn, i) => (
                    <div 
                      key={i} 
                      className={`chat-bubble-container ${turn.role === 'attacker' ? 'attacker' : 'honeypot'}`}
                    >
                      <div className="chat-sender-label">
                        {turn.role === 'attacker' ? (selectedAttacker.senderName || 'Attacker') : 'Kamla Devi (Honeypot)'}
                      </div>
                      <div className="chat-bubble">
                        {turn.text}
                      </div>
                      <div className="chat-bubble-meta">
                        {formatDate(turn.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </main>

    </div>
  );
}
