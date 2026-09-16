# Honeypot Backend Service

The backend service is a Node.js + Express REST API that orchestrates incoming Telegram traffic, persists conversation transcripts and attacker profiles in MongoDB Atlas, integrates with the LangGraph Groq honeypot agent, and enforces automated firewall protection against confirmed scammers.

---

## Features

- **Message Ingestion (`POST /api/honeypot/incoming`)**: Receives payload from Telegram (routed via n8n).
- **Automated Threat Firewall**:
  - Drops incoming messages silently if the sender is flagged as an active/blocked scammer (`isBlocked: true`).
  - Tracks blocked attempt counters and timestamps in MongoDB.
- **Per-Chat Request Serialization (`serializeChatRequest`)**: In-memory async promise queue preventing race conditions and message drops when multiple Telegram users send bursts of messages simultaneously.
- **Whitelisting Engine (`KnownContact`)**: Allows known friends/family to bypass the honeypot pipeline completely.
- **Live Threat Intel & Profile Upsert**: On any turn where `scamScore >= 6`, extracts threat indicators (UPI IDs, bank details, phishing links) and creates/updates the `AttackerProfile` in real time.
- **SOC Alert Feed & Management**: Exposes endpoints for the React dashboard (`GET /api/honeypot/alerts`, `POST /api/honeypot/block-toggle`).

---

## Environment Variables (`.env`)

Create a `.env` file in the `backend/` directory:

```env
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/honeypot?retryWrites=true&w=majority
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MAIN_MODEL=openai/gpt-oss-20b
GROQ_EXTRACT_MODEL=openai/gpt-oss-20b
```

---

## Scripts

```bash
# Install dependencies
npm install

# Run in development mode (with nodemon auto-restart)
npm run dev

# Run in production mode
npm start
```

---

## API Endpoints

### 1. Inbound Telegram Webhook
- **`POST /api/honeypot/incoming`**
- **Request Body**:
  ```json
  {
    "chatId": "6475515542",
    "senderId": "7284889093",
    "senderName": "Chethan",
    "text": "Send 500 rupees to chethan@upi immediately",
    "receivedAt": "2026-09-16T19:00:00.000Z"
  }
  ```
- **Response**:
  ```json
  {
    "isKnownContact": false,
    "reply": "Hai ram! Beta, I opened PhonePe but it says transaction pending. Can you give me your bank account number?",
    "endConversation": false,
    "isScam": true,
    "isBlocked": false,
    "confidence": 0.95,
    "classificationReasoning": "User requests money transfer to a UPI ID with urgent tone",
    "threatIntelligence": {
      "financialDetails": {
        "upiIds": [{ "id": "chethan@upi", "confidence": "high" }],
        "bankAccounts": [],
        "cards": []
      },
      "links": [],
      "attackerIdentifiers": {
        "phoneNumbers": [],
        "aliases": [],
        "handles": []
      }
    }
  }
  ```

### 2. Alerts Feed
- **`GET /api/honeypot/alerts`**: Returns array of flagged `AttackerProfile` objects sorted by most recently active.

### 3. Manual Block / Unblock Toggle
- **`POST /api/honeypot/block-toggle`**
- **Request Body**:
  ```json
  {
    "senderId": "7284889093",
    "block": true
  }
  ```

### 4. Health Check
- **`GET /health`**: Returns server status, database connection state, and uptime.
