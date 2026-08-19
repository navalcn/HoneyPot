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
    upiIds: [{ type: String }],
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
