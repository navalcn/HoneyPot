# Honeypot System Documentation

This directory contains technical schemas and architectural references for the Autonomous Honeypot system.

---

## Contents

- **[`schema.md`](file:///c:/Users/Naval/Downloads/Honeypot/docs/schema.md)**: Database schemas and data models for:
  - `Conversation` (turns, per-turn scam scores, confidence, threat intelligence snapshot).
  - `AttackerProfile` (sender identifiers, 2-tier UPI IDs, bank accounts, URLs, block status).
  - `KnownContact` (whitelisted contacts).
- **Core Architecture & Threat Extractor**:
  - 2-Tier Indian UPI regex engine classification (`Tier 1 @suffixes` vs `Tier 2 loose`).
  - Groq LPU fast inference (`openai/gpt-oss-20b`).
  - Automated Honeypot Firewall & Block policies.
