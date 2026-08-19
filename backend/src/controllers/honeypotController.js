import Conversation from '../models/Conversation.js';
import KnownContact from '../models/KnownContact.js';
import { runHoneypotAgent } from '../../../agent/src/graph.js';

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
    
    if (conversation && conversation.isConversationEnded) {
      console.log(`Conversation ${chatId} has already ended. Disengaging.`);
      return res.status(200).json({
        isKnownContact: false,
        reply: "Margaret is no longer responding.",
        endConversation: true,
        isScam: conversation.isScam,
        confidence: conversation.confidence,
        threatIntelligence: conversation.threatIntelligence
      });
    }

    if (!conversation) {
      conversation = new Conversation({
        chatId,
        senderId,
        senderName: senderName || 'Unknown Attacker',
        turns: []
      });
      console.log(`Starting new honeypot conversation session for chatId: ${chatId}`);
    }

    // 4. Append attacker's turn to database schema
    conversation.turns.push({
      role: 'attacker',
      text,
      timestamp: receivedAt ? new Date(receivedAt) : new Date()
    });

    // 5. Invoke LangGraph Agent to handle multi-turn scoring, dialogue, and final extraction
    const agentResult = await runHoneypotAgent({
      chatId,
      turns: conversation.turns
    });

    // 6. Append honeypot's response turn
    conversation.turns.push({
      role: 'honeypot',
      text: agentResult.reply,
      timestamp: new Date()
    });

    // 7. Update conversation fields in database
    conversation.isScam = agentResult.isScam;
    conversation.confidence = agentResult.confidence;
    conversation.isConversationEnded = agentResult.isConversationEnded;
    conversation.classificationReasoning = agentResult.classificationReasoning;
    conversation.threatIntelligence = agentResult.threatIntelligence;

    // 8. Persist updated conversation history in MongoDB
    await conversation.save();
    console.log(`Successfully logged turns and saved conversation state for chatId: ${chatId}`);

    // 9. Respond with reply and conversational status
    return res.status(200).json({
      isKnownContact: false,
      reply: agentResult.reply,
      endConversation: agentResult.isConversationEnded,
      isScam: agentResult.isScam,
      confidence: agentResult.confidence,
      classificationReasoning: agentResult.classificationReasoning,
      threatIntelligence: agentResult.threatIntelligence
    });

  } catch (error) {
    console.error('Error in handleIncomingMessage controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while processing the agent conversation.'
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
