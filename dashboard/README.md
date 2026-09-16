# React SOC Analyst Threat Intelligence Dashboard

A modern, dark-mode cybersecurity Operations Console (SOC) built with **React** and **Vite** for monitoring active honeypot operations, analyzing extracted forensic metadata, and managing automated firewall blocking.

---

## Features

- **Real-Time Alert Feed**: Automatically polls `/api/honeypot/alerts` every 10 seconds to surface newly flagged scammers and updated threat profiles.
- **Forensic Threat Intelligence Panels**:
  - **Flagged Financial Targets**: Displays high/low confidence verified Indian UPI tags, bank account numbers, IFSC codes, and credit cards.
  - **Malicious Domains & URLs**: Clickable external link inspector.
  - **Attacker Identifiers**: Contact phone numbers, aliases, and Telegram handles.
- **Live Multi-Turn Transcript Viewer**: Full chronological dialogue inspection between the attacker and the *Kamla Devi* honeypot persona.
- **Firewall & Block Controls**:
  - Displays real-time blocking badges (`🚫 Blocked` vs `🟡 Active Engagement`).
  - Tracks dropped message metrics from blocked attackers.
  - 1-Click manual override button to `Enforce Immediate Block 🚫` or `Unblock Sender 🟢`.

---

## Running Locally

```bash
# Navigate to dashboard directory
cd dashboard

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

*The dashboard will be available at `http://localhost:5173`.*

---

## Configuration (`vite.config.js`)

Vite is configured with an automated HTTP proxy to route `/api/*` calls directly to the Express backend running on `http://localhost:3000`.
