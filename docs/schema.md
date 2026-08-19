# Threat Intelligence Extraction Schema

This document defines the schema of the normalized JSON record extracted when a conversation is classified as a scam. The fields are populated by combining Gemini structured tool-calling with a regex validation/fallback layer.

## Normalized JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ThreatIntelligenceRecord",
  "type": "object",
  "properties": {
    "isScam": {
      "type": "boolean",
      "description": "True if the conversation is classified as a scam."
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score of the classification."
    },
    "classificationReasoning": {
      "type": "string",
      "description": "The reasoning behind the classification."
    },
    "financialDetails": {
      "type": "object",
      "properties": {
        "upiIds": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Unified Payments Interface (UPI) IDs (e.g. payinguser@okaxis)."
        },
        "bankAccounts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "accountNumber": { "type": "string" },
              "ifsc": { "type": "string", "description": "Indian Financial System Code (IFSC)." },
              "bankName": { "type": "string" }
            },
            "required": ["accountNumber", "ifsc"]
          },
          "description": "Extracted bank account details."
        },
        "cards": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Credit/debit card numbers or details."
        }
      },
      "required": ["upiIds", "bankAccounts", "cards"]
    },
    "links": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "description": "Full URL path." },
          "domain": { "type": "string", "description": "Extracted root domain name." },
          "description": { "type": "string", "description": "Brief description of the context the link was shared in." }
        },
        "required": ["url", "domain"]
      },
      "description": "Web links, domains, or portals shared by the attacker."
    },
    "attackerIdentifiers": {
      "type": "object",
      "properties": {
        "phoneNumbers": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Phone numbers shared or mentioned by the attacker."
        },
        "aliases": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Names, aliases, handles or display names used by the attacker."
        },
        "handles": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Social media handles, Telegram handles starting with @."
        }
      },
      "required": ["phoneNumbers", "aliases", "handles"]
    }
  },
  "required": [
    "isScam",
    "confidence",
    "classificationReasoning",
    "financialDetails",
    "links",
    "attackerIdentifiers"
  ]
}
```

## Extraction & Normalization Logic

1. **AI Extraction**: Gemini is invoked with specialized Zod schemas to extract structured data in three areas:
   - Financial Details (`extractFinancialDetails`)
   - Links & Domains (`extractLinks`)
   - Attacker Identifiers (`extractAttackerIdentifiers`)
2. **Regex Validation Fallback**: A regex pass scans the full transcript raw text for specific formats:
   - **UPI IDs**: `[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}`
   - **URLs**: `https?:\/\/[^\s]+`
   - **Telegram Handles**: `@[a-zA-Z0-9_]{5,32}`
   - **Indian Phone Numbers**: `(?:\+91[\-\s]?)?[6-9]\d{9}`
3. **Merge & Deduplicate**: The elements from both steps are consolidated, normalized (e.g. converting domains to lowercase, removing formatting from phone numbers), and deduped into the final JSON output record.
