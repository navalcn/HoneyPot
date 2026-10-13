import express from 'express';
import { 
  handleIncomingMessage, 
  addKnownContact,
  getKnownContacts,
  deleteKnownContact,
  getRecentAlerts, 
  getAllConversations, 
  getConversationById,
  toggleBlockSender
} from '../controllers/honeypotController.js';

const router = express.Router();

// Route to ingest messages from Telegram
router.post('/incoming', handleIncomingMessage);

// Route to fetch recent alerts / flagged attacker profiles
router.get('/alerts', getRecentAlerts);

// Route to fetch all conversations list
router.get('/conversations', getAllConversations);

// Route to fetch a single conversation by chatId
router.get('/conversations/:chatId', getConversationById);

// Route to manually block/unblock a senderId
router.post('/block-toggle', toggleBlockSender);

// Known Contacts (Whitelist) CRUD routes
router.get('/contacts', getKnownContacts);
router.post('/whitelist', addKnownContact);
router.delete('/contacts/:senderId', deleteKnownContact);

export default router;
