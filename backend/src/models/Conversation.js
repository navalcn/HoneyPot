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
  }
}, {
  timestamps: true
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
