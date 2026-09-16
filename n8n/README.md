# n8n Telegram Webhook & Routing Workflows

This directory contains workflow configurations and documentation for integrating the Honeypot backend with Telegram via **n8n**.

---

## Workflow Overview

1. **Telegram Trigger Node**:
   - Listens for incoming messages sent to the Honeypot Telegram Bot (`@bot_username`).
   - Extracts payload parameters: `chatId`, `senderId`, `senderName`, `text`, `receivedAt`.

2. **HTTP Request Node (Honeypot Backend Ingestion)**:
   - Dispatches a `POST` request to `http://<backend_host>:3000/api/honeypot/incoming`.
   - Passes JSON body:
     ```json
     {
       "chatId": "={{ $json.message.chat.id }}",
       "senderId": "={{ $json.message.from.id }}",
       "senderName": "={{ $json.message.from.first_name }}",
       "text": "={{ $json.message.text }}",
       "receivedAt": "={{ new Date().toISOString() }}"
     }
     ```

3. **Conditional Reply Node (Telegram Dispatch)**:
   - If the backend returns `reply !== null` and `isBlocked === false`, sends the *Kamla Devi* honeypot response back to the Telegram chat.
   - If `reply === null` (Silent Mode for neutral greetings, or dropped by firewall for blocked scammers), no outbound message is sent.
