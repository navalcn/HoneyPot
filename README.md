# Agentic AI-Driven Honeypot for Autonomous Scam Detection

An active-engagement honeypot designed to automatically interact with scammers, analyze conversation text, and extract structured threat intelligence (UPI IDs, bank details, phishing links, attacker handles) to prevent future fraud.

## Project Structure

This project is set up as a monorepo containing:
- **`backend/`**: Node.js + Express API server (ingestion, storage, threat intelligence reports, alerts).
- **`agent/`**: LangGraph + Anthropic conversational engagement agent (Phase C).
- **`dashboard/`**: React application to view flagged scammers and alerts (Phase F).
- **`n8n/`**: Exported workflows for routing Telegram traffic into the honeypot pipeline.
- **`docs/`**: System architecture schemas and documentation.

---

## Phase A: Skeleton Setup

Currently, Phase A establishes:
1. The **monorepo directory structure**.
2. A **Node.js + Express application** in `/backend` configured with:
   - MongoDB database connection layer (Mongoose).
   - Environment variable management (`dotenv`).
   - CORS and JSON middleware.
   - A health check route (`GET /health`) checking server and DB state.
3. A local verification workflow.

---

## Getting Started (Backend)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally (port `27017`) or a MongoDB Atlas connection string.

### 1. Installation
Navigate to the `backend` directory and install dependencies:
```bash
cd backend
npm install
```

### 2. Environment Configuration
An `.env` configuration file has been automatically initialized in the `backend/` directory. If you need to customize the port or database URI, edit `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/honeypot
```

### 3. Running the Server

#### Development Mode (with hot-reloading)
To start the server with nodemon auto-restart:
```bash
npm run dev
```

#### Production Mode
To start the server normally:
```bash
npm run start
```

---

## Verification

To verify that the Express app boots and connects to MongoDB:

1. Start the server (e.g., `npm run dev`).
2. Make a request to the health check endpoint:
   - **Endpoint**: `GET http://localhost:5000/health`
   - **Response Structure**:
     ```json
     {
       "status": "UP",
       "database": "CONNECTED",
       "timestamp": "2026-08-13T12:00:00.000Z",
       "uptime": 12.34
     }
     ```
