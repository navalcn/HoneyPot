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
                  <div className="threat-badge scam">Scam</div>
                </div>
                <div className="threat-meta">
                  <span>ID: {attacker.senderId}</span>
                  {attacker.financialDetails?.upiIds?.length > 0 && (
                    <span style={{ color: 'var(--color-accent-red)' }}>
                      UPI: {attacker.financialDetails.upiIds[0]}
                    </span>
                  )}
                  {attacker.links?.length > 0 && (
                    <span style={{ color: 'var(--color-accent-blue)' }}>
                      Link: {attacker.links[0].domain}
                    </span>
                  )}
                </div>
                <div className="threat-time">{formatDate(attacker.createdAt)}</div>
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
                <h3 className="panel-section-title">Attacker Classification</h3>
                <div className="intel-card" style={{ borderLeft: '4px solid var(--color-accent-red)' }}>
                  <div className="card-title" style={{ color: 'var(--color-accent-red)' }}>
                    SCAM DETECTED
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-text-main)' }}>
                    {selectedAttacker.classificationReasoning || "Threat classified as active financial scamming attempt."}
                  </p>
                  <div style={{ marginTop: '14px', display: 'flex', gap: '12px' }}>
                    <div className="console-status" style={{ backgroundColor: 'var(--color-accent-red-glow)', color: 'var(--color-accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      Confidence: {(selectedAttacker.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="console-status" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-text-muted)' }}>
                      Sender ID: {selectedAttacker.senderId}
                    </div>
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
                      selectedAttacker.financialDetails.upiIds.map((upi, i) => (
                        <div key={i} className="threat-tag danger">{upi}</div>
                      ))
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
