import mongoose from 'mongoose';

const knownContactSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const KnownContact = mongoose.model('KnownContact', knownContactSchema);

export default KnownContact;
