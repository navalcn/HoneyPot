import express from 'express';
import { handleIncomingMessage, addKnownContact, getRecentAlerts } from '../controllers/honeypotController.js';

const router = express.Router();

// Route to ingest messages from Telegram
router.post('/incoming', handleIncomingMessage);

// Helper route to whitelist a user ID (for manual testing)
router.post('/whitelist', addKnownContact);

// Route to fetch recent alerts / flagged attacker profiles
router.get('/alerts', getRecentAlerts);

export default router;
