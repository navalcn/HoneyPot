import Conversation from '../models/Conversation.js';
import KnownContact from '../models/KnownContact.js';

/**
 * Handles incoming messages from Telegram (routed via n8n).
 * POST /api/honeypot/incoming
 */
export const handleIncomingMessage = async (req, res) => {
  try {
    const { chatId, senderId, senderName, text, receivedAt } = req.body;

    // 1. Basic validation
    if (!chatId || !senderId || text === undefined) {
      return res.status(400).json({
        error: 'Missing required parameters: chatId, senderId, and text are required.'
      });
    }

    // 2. Check if the sender is whitelisted as a known contact
    const whitelisted = await KnownContact.findOne({ senderId });
    if (whitelisted) {
      console.log(`Whitelisted contact detected (senderId: ${senderId}). Passing through.`);
      return res.status(200).json({
        isKnownContact: true,
        reply: null,
        endConversation: true
      });
    }

    // 3. Retrieve existing conversation or initialize a new one
    let conversation = await Conversation.findOne({ chatId });
    if (!conversation) {
      conversation = new Conversation({
        chatId,
        senderId,
        senderName: senderName || 'Unknown Attacker',
        turns: []
      });
      console.log(`Starting new honeypot conversation session for chatId: ${chatId}`);
    }

    // 4. Append attacker's turn
    conversation.turns.push({
      role: 'attacker',
      text,
      timestamp: receivedAt ? new Date(receivedAt) : new Date()
    });

    // 5. Generate hardcoded honeypot response (no AI integrated in Phase B yet)
    const mockReply = "Hello! This is a simulated honeypot reply. We will engage further soon.";
    
    // Append honeypot's turn
    conversation.turns.push({
      role: 'honeypot',
      text: mockReply,
      timestamp: new Date()
    });

    // 6. Persist conversation history in MongoDB
    await conversation.save();
    console.log(`Successfully logged turns and saved conversation for chatId: ${chatId}`);

    // 7. Respond with reply and conversational status
    return res.status(200).json({
      isKnownContact: false,
      reply: mockReply,
      endConversation: false
    });

  } catch (error) {
    console.error('Error in handleIncomingMessage controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while processing the message.'
    });
  }
};

/**
 * Whitelists a sender ID so their messages bypass the honeypot pipeline.
 * POST /api/honeypot/whitelist
 */
export const addKnownContact = async (req, res) => {
  try {
    const { senderId, name } = req.body;

    if (!senderId) {
      return res.status(400).json({ error: 'senderId is required to whitelist a contact.' });
    }

    let contact = await KnownContact.findOne({ senderId });
    if (contact) {
      return res.status(200).json({
        message: 'Contact is already whitelisted.',
        contact
      });
    }

    contact = new KnownContact({
      senderId,
      name: name || 'Whitelisted User'
    });

    await contact.save();
    console.log(`Whitelisted contact registered: ${senderId} (${contact.name})`);

    return res.status(201).json({
      success: true,
      message: 'Contact successfully whitelisted.',
      contact
    });

  } catch (error) {
    console.error('Error in addKnownContact controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while whitelisting the contact.'
    });
  }
};
