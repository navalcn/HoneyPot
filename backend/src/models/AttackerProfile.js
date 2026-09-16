import mongoose from 'mongoose';

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

const attackerProfileSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  senderName: {
    type: String,
    default: ''
  },
  isScam: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String,
    default: ''
  },
  blockedAt: {
    type: Date,
    default: null
  },
  blockedAttemptsCount: {
    type: Number,
    default: 0
  },
  lastBlockedAttempt: {
    type: Date,
    default: null
  },
  confidence: {
    type: Number,
    default: 0
  },
  classificationReasoning: {
    type: String,
    default: ''
  },
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
  },
  associatedChats: [{
    type: String,
    default: []
  }]
}, {
  timestamps: true
});

const AttackerProfile = mongoose.model('AttackerProfile', attackerProfileSchema);

export default AttackerProfile;
