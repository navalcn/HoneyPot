# Autonomous Honeypot Conversational Agent & Threat Extractor

The `agent/` module contains the LangGraph state machine, the Groq LPU inference engine, the deceptive *Kamla Devi* honeypot persona, and the 2-tier forensic threat extractor.

---

## Architecture & Workflow

```
[START]
   │
   ▼
[processTurnNode] (Groq LPU: Single-pass scam evaluation + Kamla Devi response generation)
   │
   ▼
[routeConversation]
   ├── If turnCount < 12 ──────────────────────────► [END] (Returns reply to stall scammer)
   └── If turnCount >= 12 (Max Stalling Reached) ──► [classificationNode]
                                                           │
                                                           ▼
                                                     [Final Classification & Threat Extraction]
                                                           │
                                                           ▼
                                                         [END]
```

---

## Core Components

### 1. `src/graphGroq.js`
- Powered by **Groq LPUs** using `openai/gpt-oss-20b` (sub-300ms inference latency).
- **Single-Pass Evaluation**: Combines scam-likelihood scoring (0-10 scale) and stalling dialogue generation in a single LPU call.
- **Smart Silent Mode**: If incoming message is a neutral greeting (`"Hi"`, `"Hello"`, `"test"`) with `scamScore <= 2`, sets `reply: null` to avoid blowing cover.
- **Stalling Threshold**: Keeps the conversation active for up to 12 turns to maximize intelligence gathering before graceful disengagement.

### 2. `src/config/persona.js` (*Kamla Devi*)
- **Persona**: 65-year-old retired schoolteacher living in Jaipur, texting on a budget Android smartphone. Gullible, polite, easily frightened by official-sounding threats, clumsy with digital payments.
- **5-Stage Stalling Playbook**:
  1. *Stage 1 (Hook & Panic)*: Reacts with genuine worry or excitement; asks the scammer for guidance.
  2. *Stage 2 (Fake App UI Confusion)*: Pretends to open PhonePe/GPay/Amazon; describes loading spinners or password screens.
  3. *Stage 3 (Simulated Payment Failure)*: Claims the app failed or UPI server timed out; asks the scammer for a backup UPI ID, QR code, or direct bank account number.
  4. *Stage 4 (OTP Confusion)*: Claims SMS OTP arrived in Hindi or has expired numbers; asks for alternative verification.
  5. *Stage 5 (Disengagement)*: Gracefully disengages by claiming her tea is ready or she needs to consult her grandson Aarav.

### 3. `src/utils/extractor.js` (Forensic Threat Extractor)
- **2-Tier Indian UPI Regex Engine**:
  - *Tier 1 (High Confidence)*: Matches verified Indian UPI VPA suffixes (`@okaxis`, `@oksbi`, `@okhdfcbank`, `@okicici`, `@ybl`, `@paytm`, `@upi`, `@axl`, `@ibl`, `@apl`, `@hdfcbank`, `@icici`).
  - *Tier 2 (Low Confidence)*: Catches arbitrary `@suffix` patterns without false positives on standard email addresses.
- **Parallel LLM Extraction**: Extracts Bank Account Numbers, IFSC codes, bank names, credit/debit cards, phishing links/domains, and Telegram `@handles` / phone numbers concurrently.
