import mongoose from 'mongoose';

const turnSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['attacker', 'honeypot'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// UPI ID entry with confidence tier (Issue 2)
const upiIdSchema = new mongoose.Schema({
  id:         { type: String, default: '' },
  confidence: { type: String, enum: ['high', 'low'], default: 'low' }
}, { _id: false });

const bankAccountSchema = new mongoose.Schema({
  accountNumber: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  bankName: { type: String, default: '' }
}, { _id: false });

const linkSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  domain: { type: String, default: '' },
  description: { type: String, default: '' }
}, { _id: false });

const threatIntelligenceSchema = new mongoose.Schema({
  financialDetails: {
    upiIds: [upiIdSchema],      // { id, confidence: 'high'|'low' }
    bankAccounts: [bankAccountSchema],
    cards: [{ type: String }]
  },
  links: [linkSchema],
  attackerIdentifiers: {
    phoneNumbers: [{ type: String }],
    aliases: [{ type: String }],
    handles: [{ type: String }]
  }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  senderId: {
    type: String,
    required: true,
    index: true
  },
  senderName: {
    type: String,
    default: ''
  },
  turns: [turnSchema],
  // Explicit attacker-turn counter (Issue 3).
  // Incremented by 1 for every inbound attacker message — NOT derived from turns.length,
  // so multi-message bursts before a bot reply are counted correctly.
  turnCount: {
    type: Number,
    default: 0
  },
  // Per-turn score history (Issue 4).
  // Each entry records the scam-likelihood score Mistral assigned on that attacker turn.
  // Exposed via GET /api/honeypot/conversations/:chatId so the dashboard can chart the trajectory.
  turnScores: [{
    turnNumber: { type: Number, required: true },
    score:      { type: Number, required: true },
    reasoning:  { type: String, default: '' },
    timestamp:  { type: Date,   default: Date.now }
  }],
  isScam: {
    type: Boolean,
    default: false
  },
  confidence: {
    type: Number,
    default: 0
  },
  isConversationEnded: {
    type: Boolean,
    default: false
  },
  classificationReasoning: {
    type: String,
    default: ''
  },
  threatIntelligence: {
    type: threatIntelligenceSchema,
    default: null
  }
}, {
  timestamps: true
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
