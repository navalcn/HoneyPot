# Agentic AI-Driven Honeypot for Autonomous Scam Detection & Threat Intelligence Extraction

An autonomous, active-engagement cybersecurity honeypot designed to detect financial scams in real time, stall attackers using a dynamic deceptive persona (*Kamla Devi*), autonomously extract forensic threat intelligence (UPI IDs, bank accounts, phishing URLs, attacker handles), and enforce automated firewall blocking on confirmed scammers.

---

## System Architecture

```
                                  +---------------------------------------+
                                  |            Telegram Attacker          |
                                  +---------------------------------------+
                                                      │
                                                      ▼
                                  +---------------------------------------+
                                  |         n8n Automation Engine         |
                                  +---------------------------------------+
                                                      │  POST /incoming
                                                      ▼
                        ┌───────────────────────────────────────────────────────────┐
                        │                 Node.js / Express Backend                 │
                        │                                                           │
                        │  1. Whitelist / Known-Contact Bypass Check                │
                        │  2. Automated Firewall Check (Drops Blocked Scammers)     │
                        │  3. Per-Chat Request Serializer (Concurrency Guard)       │
                        └─────────────────────────────┬─────────────────────────────┘
                                                      │
                                                      ▼
                        ┌───────────────────────────────────────────────────────────┐
                        │             LangGraph Autonomous Agent Engine             │
                        │                                                           │
                        │  • Groq LPU (<300ms Inference via openai/gpt-oss-20b)     │
                        │  • Scam-Likelihood Scoring (0 - 10)                       │
                        │  • Smart Silent Mode (score <= 2 -> No reply)             │
                        │  • Kamla Devi 5-Stage Deceptive Stalling Persona          │
                        │  • Multi-Turn State Machine (Stalls up to 12 turns)       │
                        └─────────────────────────────┬─────────────────────────────┘
                                                      │
                                                      ▼
                        ┌───────────────────────────────────────────────────────────┐
                        │            Forensic Threat Intelligence Extractor         │
                        │                                                           │
                        │  • 2-Tier High/Low Confidence Indian UPI Regex Engine     │
                        │  • Bank Account & IFSC Code Extraction                    │
                        │  • Phishing URLs & Malicious Domains Extractor            │
                        │  • Phone Numbers & Telegram Handles                       │
                        └─────────────────────────────┬─────────────────────────────┘
                                                      │
                                                      ▼
                        ┌───────────────────────────────────────────────────────────┐
                        │                   MongoDB Atlas Database                  │
                        │                                                           │
                        │  • Conversations: Full multi-turn transcripts & scores    │
                        │  • AttackerProfiles: IOCs, confidence, and block state    │
                        │  • KnownContacts: Whitelisted friends / family            │
                        └─────────────────────────────┬─────────────────────────────┘
                                                      │  Real-time Polling / API
                                                      ▼
                        ┌───────────────────────────────────────────────────────────┐
                        │                 React SOC Analyst Console                 │
                        │                                                           │
                        │  • Live Honeypot Alert Feed & Flagged Scammer Profiles    │
                        │  • IOC Metadata Viewer (UPI, Bank, URL, Phone Tags)       │
                        │  • Real-Time Multi-Turn Chat Transcript Inspector         │
                        │  • 1-Click SOC Firewall Controls (Block / Unblock)        │
                        └───────────────────────────────────────────────────────────┘
```

---

## Monorepo Directory Structure

```
Honeypot/
├── agent/                  # LangGraph state machine, Groq LPUs, persona, & threat extractor
│   ├── src/
│   │   ├── config/persona.js      # Kamla Devi 5-stage deceptive honeypot playbook
│   │   ├── utils/extractor.js     # 2-Tier UPI regex & parallel LLM threat extractor
│   │   ├── graphGroq.js           # Groq LPU single-pass state graph
│   │   └── graphOpenRouter.js     # OpenRouter fallback graph
│   └── README.md
├── backend/                # Express.js REST API & MongoDB database persistence layer
│   ├── src/
│   │   ├── config/db.js           # MongoDB Atlas Mongoose connection
│   │   ├── controllers/           # honeypotController.js (incoming, alerts, firewall)
│   │   ├── models/                # Conversation, AttackerProfile, KnownContact schemas
│   │   └── routes/                # Express honeypot API routing
│   ├── server.js                  # Application server entry point (Port 3000)
│   └── README.md
├── dashboard/              # React + Vite SOC Threat Intelligence Console
│   ├── src/
│   │   ├── App.jsx                # Console layout, threat cards, transcript viewer, block controls
│   │   ├── index.css              # Cyber-security dark mode design system
│   │   └── main.jsx               # React entry point
│   ├── vite.config.js             # API proxy configuration to backend:3000
│   └── README.md
├── docs/                   # System schemas and architectural documentation
│   ├── schema.md                  # Database & Threat Intelligence JSON schemas
│   └── README.md
├── n8n/                    # n8n webhook workflows for Telegram bot routing
│   └── README.md
└── README.md               # Monorepo documentation
```

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: MongoDB Atlas URI or local instance
- **Groq API Key**: Free API key from [Groq Console](https://console.groq.com)

---

### 1. Backend Setup

1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   npm install
   ```

2. Create/update `backend/.env`:
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_atlas_connection_string
   GROQ_API_KEY=your_groq_api_key
   GROQ_MAIN_MODEL=openai/gpt-oss-20b
   GROQ_EXTRACT_MODEL=openai/gpt-oss-20b
   ```

3. Start the backend in development mode:
   ```bash
   npm run dev
   ```
   *The server will start on `http://localhost:3000`.*

---

### 2. Dashboard Setup

1. Open a second terminal and navigate to `dashboard/`:
   ```bash
   cd dashboard
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser to access the SOC Analyst Console.*

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/honeypot/incoming` | Ingests incoming Telegram messages, evaluates scam score, runs honeypot persona, extracts IOCs, and checks firewall |
| `GET` | `/api/honeypot/alerts` | Returns the feed of recent flagged scammer profiles and extracted IOCs |
| `GET` | `/api/honeypot/conversations` | Lists all conversation records |
| `GET` | `/api/honeypot/conversations/:chatId` | Returns the full multi-turn transcript and turn scores for a chat session |
| `POST` | `/api/honeypot/block-toggle` | Manually blocks or unblocks a `senderId` from the SOC console |
| `POST` | `/api/honeypot/whitelist` | Whitelists a sender ID to bypass the honeypot pipeline |
| `GET` | `/health` | Health-check endpoint verifying server uptime and MongoDB connection |

---

## Key Features

- ⚡ **Ultra-Low Latency (<300ms)**: Direct Groq LPU inference using `openai/gpt-oss-20b`.
- 🤫 **Smart Silent Mode**: Ignores neutral greetings (`"Hi"`, `"Hello"`) without alerting attackers.
- 👵 **Kamla Devi Persona**: 5-stage progressive stalling playbook (feigning panic, fake app loading, UPI failure, asking for backup QR/accounts).
- 🔍 **Forensic Extraction**: 2-tier high-confidence Indian UPI regex + parallel LLM extraction for bank details, cards, URLs, and phone numbers.
- 🚫 **Automated Threat Firewall**: Permanently blocks confirmed scammers once engagement concludes, dropping all subsequent inbound messages.
- 📊 **Real-Time SOC Console**: Clean, dark-mode threat monitoring dashboard with 1-click firewall controls.
