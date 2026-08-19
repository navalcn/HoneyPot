import express from 'express';
import { handleIncomingMessage, addKnownContact } from '../controllers/honeypotController.js';

const router = express.Router();

// Route to ingest messages from Telegram
router.post('/incoming', handleIncomingMessage);

// Helper route to whitelist a user ID (for manual testing)
router.post('/whitelist', addKnownContact);

export default router;
