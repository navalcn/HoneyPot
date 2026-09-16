import express from 'express';
import { 
  handleIncomingMessage, 
  addKnownContact, 
  getRecentAlerts, 
  getAllConversations, 
  getConversationById,
  toggleBlockSender
} from '../controllers/honeypotController.js';

const router = express.Router();

// Route to ingest messages from Telegram
router.post('/incoming', handleIncomingMessage);

// Helper route to whitelist a user ID (for manual testing)
router.post('/whitelist', addKnownContact);

// Route to manually block/unblock a senderId
router.post('/block-toggle', toggleBlockSender);

// Route to fetch recent alerts / flagged attacker profiles
router.get('/alerts', getRecentAlerts);

// Route to fetch all conversations list
router.get('/conversations', getAllConversations);

// Route to fetch a single conversation by chatId
router.get('/conversations/:chatId', getConversationById);

export default router;
