import mongoose from 'mongoose';

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
  confidence: {
    type: Number,
    default: 0
  },
  classificationReasoning: {
    type: String,
    default: ''
  },
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
