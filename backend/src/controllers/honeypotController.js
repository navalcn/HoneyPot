import Conversation from '../models/Conversation.js';
import KnownContact from '../models/KnownContact.js';
import AttackerProfile from '../models/AttackerProfile.js';
import { runHoneypotAgent } from '../../../agent/src/graphGroq.js';

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
      // CONTRACT: `reply` is intentionally null for known/whitelisted contacts.
      // The honeypot MUST NOT auto-reply to these senders — doing so would expose
      // the bot's existence to trusted people in the operator's contact list.
      // Consumers of this response (e.g. the n8n workflow) MUST read the original
      // Telegram message directly from the trigger node and forward it to the
      // operator — they MUST NOT use `reply` from this payload for any send action.
      return res.status(200).json({
        isKnownContact: true,
        reply: null,       // Always null — DO NOT use this field for known contacts.
        endConversation: true
      });
    }

    // 3. Retrieve existing conversation or initialize a new one
    let conversation = await Conversation.findOne({ chatId });

    // If user typed /reset or /start in Telegram, silently reset the session
    if (text.trim() === '/start' || text.trim() === '/reset') {
      if (conversation) {
        await Conversation.deleteOne({ chatId });
        console.log(`[Reset] Cleaned up session for chatId: ${chatId}`);
      }
      return res.status(200).json({
        isKnownContact: true,
        reply: null, // Silent pass-through, no message sent to Telegram
        endConversation: true
      });
    }

    
    // If previous conversation completed its lifecycle, start a fresh conversation
    if (conversation && conversation.isConversationEnded) {
      console.log(`Previous conversation for ${chatId} ended. Starting a fresh session.`);
      // Archive old chat ID by appending timestamp so history is preserved in DB
      conversation.chatId = `${chatId}_archived_${Date.now()}`;
      await conversation.save();
      conversation = null; // Forces new session creation below
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


    // 4. Append attacker's turn and increment explicit turn counter (Issue 3)
    conversation.turns.push({
      role: 'attacker',
      text,
      timestamp: receivedAt ? new Date(receivedAt) : new Date()
    });
    conversation.turnCount = (conversation.turnCount || 0) + 1;

    // 5. Invoke LangGraph Agent — pass stored turnCount so burst messages don't undercount (Issue 3)
    const agentResult = await runHoneypotAgent({
      chatId,
      turns: conversation.turns,
      turnCount: conversation.turnCount
    });

    // 6. Append honeypot's response turn
    conversation.turns.push({
      role: 'honeypot',
      text: agentResult.reply,
      timestamp: new Date()
    });

    // 7. Persist per-turn scam score (Issue 4) — always recorded, even on non-terminal turns
    conversation.turnScores.push({
      turnNumber: conversation.turnCount,
      score:      agentResult.scamScore     ?? 0,
      reasoning:  agentResult.scamReason    ?? '',
      timestamp:  new Date()
    });

    // 8. Update conversation fields in database
    conversation.isScam = agentResult.isScam;
    conversation.confidence = agentResult.confidence;
    conversation.isConversationEnded = agentResult.isConversationEnded;
    conversation.classificationReasoning = agentResult.classificationReasoning;
    conversation.threatIntelligence = agentResult.threatIntelligence;

    // Save updated history
    await conversation.save();
    console.log(`Successfully logged turns and saved conversation state for chatId: ${chatId}`);

    // 8. If conversation ended and verified as a scam, update/create attacker profile
    if (agentResult.isConversationEnded && agentResult.isScam) {
      try {
        let profile = await AttackerProfile.findOne({ senderId: conversation.senderId });
        if (!profile) {
          profile = new AttackerProfile({
            senderId: conversation.senderId,
            senderName: conversation.senderName,
            financialDetails: { upiIds: [], bankAccounts: [], cards: [] },
            links: [],
            attackerIdentifiers: { phoneNumbers: [], aliases: [], handles: [] },
            associatedChats: []
          });
          console.log(`Creating new AttackerProfile for senderId: ${conversation.senderId}`);
        } else {
          console.log(`Updating existing AttackerProfile for senderId: ${conversation.senderId}`);
        }

        profile.isScam = agentResult.isScam;
        profile.confidence = agentResult.confidence;
        profile.classificationReasoning = agentResult.classificationReasoning;

        // Merge UPI IDs — dedup by .id, upgrade confidence low→high if possible
        const upiMap = new Map();
        [...(profile.financialDetails?.upiIds || []), ...(agentResult.threatIntelligence?.financialDetails?.upiIds || [])].forEach(u => {
          const existing = upiMap.get(u.id);
          // Keep or upgrade: 'high' always wins over 'low'
          if (!existing || (existing.confidence === 'low' && u.confidence === 'high')) {
            upiMap.set(u.id, { id: u.id, confidence: u.confidence });
          }
        });
        profile.financialDetails.upiIds = Array.from(upiMap.values());

        // Merge Cards
        const cardSet = new Set([...(profile.financialDetails?.cards || []), ...(agentResult.threatIntelligence?.financialDetails?.cards || [])]);
        profile.financialDetails.cards = Array.from(cardSet);

        // Merge Bank Accounts
        const newAccounts = agentResult.threatIntelligence?.financialDetails?.bankAccounts || [];
        newAccounts.forEach(newAcc => {
          if (!profile.financialDetails.bankAccounts.some(acc => acc.accountNumber === newAcc.accountNumber)) {
            profile.financialDetails.bankAccounts.push(newAcc);
          }
        });

        // Merge Links
        const newLinks = agentResult.threatIntelligence?.links || [];
        newLinks.forEach(newLink => {
          if (!profile.links.some(l => l.url.toLowerCase() === newLink.url.toLowerCase())) {
            profile.links.push(newLink);
          }
        });

        // Merge Phone Numbers
        const phoneSet = new Set([...(profile.attackerIdentifiers?.phoneNumbers || []), ...(agentResult.threatIntelligence?.attackerIdentifiers?.phoneNumbers || [])]);
        profile.attackerIdentifiers.phoneNumbers = Array.from(phoneSet);

        // Merge Aliases
        const aliasSet = new Set([...(profile.attackerIdentifiers?.aliases || []), ...(agentResult.threatIntelligence?.attackerIdentifiers?.aliases || [])]);
        profile.attackerIdentifiers.aliases = Array.from(aliasSet);

        // Merge Handles
        const handleSet = new Set([...(profile.attackerIdentifiers?.handles || []), ...(agentResult.threatIntelligence?.attackerIdentifiers?.handles || [])]);
        profile.attackerIdentifiers.handles = Array.from(handleSet);

        // Track associated chat
        if (!profile.associatedChats.includes(chatId)) {
          profile.associatedChats.push(chatId);
        }

        await profile.save();

        console.log(`🚨 ALERT BROADCAST: Attacker Profile successfully saved!`);
        console.log(`Attacker: ${profile.senderName} (ID: ${profile.senderId})`);
        console.log(`Flagged UPIs: ${profile.financialDetails.upiIds.join(', ') || 'None'}`);
        console.log(`Flagged Links: ${profile.links.map(l => l.url).join(', ') || 'None'}`);
        console.log(`Flagged Handles: ${profile.attackerIdentifiers.handles.join(', ') || 'None'}`);

      } catch (err) {
        console.error('Error saving AttackerProfile:', err);
      }
    }

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
 * Exposes a feed of recent alerts / flagged attacker profiles.
 * GET /api/honeypot/alerts
 */
export const getRecentAlerts = async (req, res) => {
  try {
    const alerts = await AttackerProfile.find().sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Error in getRecentAlerts controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while fetching alerts.'
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

/**
 * Retrieves all conversation records.
 * GET /api/honeypot/conversations
 */
export const getAllConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ updatedAt: -1 });
    return res.status(200).json(conversations);
  } catch (error) {
    console.error('Error in getAllConversations controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while fetching conversations.'
    });
  }
};

/**
 * Retrieves a single conversation by chatId.
 * GET /api/honeypot/conversations/:chatId
 */
export const getConversationById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const conversation = await Conversation.findOne({ chatId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    return res.status(200).json(conversation);
  } catch (error) {
    console.error('Error in getConversationById controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while fetching the conversation.'
    });
  }
};
