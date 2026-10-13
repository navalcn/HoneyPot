import Conversation from '../models/Conversation.js';
import KnownContact from '../models/KnownContact.js';
import AttackerProfile from '../models/AttackerProfile.js';
import { runHoneypotAgent } from '../../../agent/src/graphGroq.js';
import { extractAllThreatIntel } from '../../../agent/src/utils/extractor.js';
import { enrichThreatIntelligence } from '../utils/threatEnricher.js';
import { extractMultiModalThreats } from '../../../agent/src/utils/multimodalExtractor.js';

// In-memory per-chat queue to serialize concurrent/burst messages per chatId
const chatQueues = new Map();

const serializeChatRequest = (chatId, fn) => {
  const previous = chatQueues.get(chatId) || Promise.resolve();
  let resolveCurrent;
  const current = new Promise(resolve => { resolveCurrent = resolve; });
  chatQueues.set(chatId, current);

  return previous
    .then(fn)
    .finally(() => {
      resolveCurrent();
      if (chatQueues.get(chatId) === current) {
        chatQueues.delete(chatId);
      }
    });
};

/**
 * Handles incoming messages from Telegram (routed via n8n).
 * POST /api/honeypot/incoming
 */
export const handleIncomingMessage = async (req, res) => {
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

  // 3. Automated Blocking Enforcement: Check if sender is an already flagged/blocked scammer
  const existingAttacker = await AttackerProfile.findOne({ senderId });
  let existingConv = await Conversation.findOne({ chatId });

  if (existingAttacker && (existingAttacker.isBlocked || (existingAttacker.isScam && existingConv?.isConversationEnded))) {
    existingAttacker.isBlocked = true;
    existingAttacker.blockedAttemptsCount = (existingAttacker.blockedAttemptsCount || 0) + 1;
    existingAttacker.lastBlockedAttempt = new Date();
    await existingAttacker.save();

    console.log(`🚫 [AUTO-BLOCK ENFORCED] Inbound message from flagged scammer blocked! (senderId: ${senderId}, Name: ${existingAttacker.senderName || 'Scammer'}, Attempts: ${existingAttacker.blockedAttemptsCount})`);

    return res.status(200).json({
      isBlocked: true,
      isScam: true,
      reply: null, // Silent drop / no honeypot reply to blocked scammers
      endConversation: true,
      message: "Sender is flagged as a confirmed scammer. Inbound communication blocked."
    });
  }

  // Process this chat's messages sequentially using the serializer
  try {
    const result = await serializeChatRequest(chatId, async () => {
      // 4. Retrieve existing conversation or initialize a new one
      let conversation = await Conversation.findOne({ chatId });

      // If user typed /reset or /start in Telegram, silently reset the session
      if (text.trim() === '/start' || text.trim() === '/reset') {
        if (conversation) {
          await Conversation.deleteOne({ chatId });
          console.log(`[Reset] Cleaned up session for chatId: ${chatId}`);
        }
        return {
          statusCode: 200,
          payload: {
            isKnownContact: true,
            reply: null,
            endConversation: true
          }
        };
      }
      
      // If previous conversation completed its lifecycle, start a fresh conversation
      if (conversation && conversation.isConversationEnded) {
        console.log(`Previous conversation for ${chatId} ended. Starting a fresh session.`);
        conversation.chatId = `${chatId}_archived_${Date.now()}`;
        await conversation.save();
        conversation = null;
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

      // 4. Append attacker's turn and increment turn counter
      conversation.turns.push({
        role: 'attacker',
        text,
        timestamp: receivedAt ? new Date(receivedAt) : new Date()
      });
      conversation.turnCount = (conversation.turnCount || 0) + 1;

      // 5. Invoke LangGraph Agent
      const agentResult = await runHoneypotAgent({
        chatId,
        turns: conversation.turns,
        turnCount: conversation.turnCount
      });

      // 6. If agent replied (non-null), append honeypot's response turn
      if (agentResult.reply) {
        conversation.turns.push({
          role: 'honeypot',
          text: agentResult.reply,
          timestamp: new Date()
        });
      }

      // 7. Persist per-turn scam score
      conversation.turnScores.push({
        turnNumber: conversation.turnCount,
        score:      agentResult.scamScore     ?? 0,
        reasoning:  agentResult.scamReason    ?? '',
        timestamp:  new Date()
      });

      // 8. Live Threat Intelligence extraction on any turn with score >= 6
      let currentThreatIntel = agentResult.threatIntelligence;
      const isScamTurn = (agentResult.scamScore >= 6) || agentResult.isScam;

      if (isScamTurn && !currentThreatIntel) {
        try {
          console.log(`[Live Threat Extraction] Extracting IOCs for chatId: ${chatId} (Score: ${agentResult.scamScore}/10)...`);
          currentThreatIntel = await extractAllThreatIntel(conversation.turns);
        } catch (err) {
          console.warn('Threat extraction warning:', err.message);
        }
      }

      // Check if incoming request contained multimodal OCR or QR payloads (2.A)
      if (req.body.qrPayload || req.body.textOCR) {
        const mmIntel = extractMultiModalThreats({
          qrPayload: req.body.qrPayload,
          textOCR: req.body.textOCR
        });
        if (mmIntel.upiIds.length > 0 || mmIntel.phishingUrls.length > 0) {
          currentThreatIntel = currentThreatIntel || { financialDetails: { upiIds: [], bankAccounts: [], cards: [] }, links: [], attackerIdentifiers: {} };
          mmIntel.upiIds.forEach(u => {
            if (!currentThreatIntel.financialDetails.upiIds.some(existing => (existing.id || existing) === u.upiId)) {
              currentThreatIntel.financialDetails.upiIds.push({ id: u.upiId, confidence: 'high' });
            }
          });
          mmIntel.phishingUrls.forEach(p => {
            if (!currentThreatIntel.links.some(l => l.url === p.url)) {
              currentThreatIntel.links.push({ url: p.url, description: 'Extracted from QR Code' });
            }
          });
        }
      }

      // 8.b Enrich extracted IOCs with external threat feeds (2.C)
      let enrichmentData = null;
      if (currentThreatIntel && currentThreatIntel.links && currentThreatIntel.links.length > 0) {
        try {
          const enriched = await enrichThreatIntelligence(currentThreatIntel);
          enrichmentData = enriched.enrichment;
        } catch (enrichErr) {
          console.warn('[Enrichment Warning]:', enrichErr.message);
        }
      }

      conversation.isScam = isScamTurn;
      conversation.confidence = agentResult.confidence || (agentResult.scamScore >= 8 ? 0.95 : 0.8);
      conversation.isConversationEnded = agentResult.isConversationEnded;
      conversation.classificationReasoning = agentResult.classificationReasoning || agentResult.scamReason;
      conversation.activePersona = agentResult.activePersona || conversation.activePersona || 'KAMLA_DEVI';
      conversation.scamCategory = agentResult.scamCategory || conversation.scamCategory || 'general_fraud';
      conversation.simulatedHumanDelayMs = agentResult.humanDelayMs || 0;
      conversation.threatIntelligence = currentThreatIntel;
      conversation.threatEnrichment = enrichmentData;

      await conversation.save();
      console.log(`[Logged Turn ${conversation.turnCount}] ChatId: ${chatId} | Persona: ${conversation.activePersona} | Score: ${agentResult.scamScore} | Typing Delay: ${conversation.simulatedHumanDelayMs}ms`);

      // 9. Real-time AttackerProfile creation/update in DB for immediate dashboard alerts!
      if (conversation.isScam) {
        try {
          let profile = await AttackerProfile.findOne({ senderId: conversation.senderId });
          if (!profile) {
            profile = new AttackerProfile({
              senderId: conversation.senderId,
              senderName: conversation.senderName || 'Anonymous Scammer',
              financialDetails: { upiIds: [], bankAccounts: [], cards: [] },
              links: [],
              attackerIdentifiers: { phoneNumbers: [], aliases: [], handles: [] },
              associatedChats: []
            });
            console.log(`[AttackerProfile] Creating new profile for senderId: ${conversation.senderId} (${profile.senderName})`);
          }

          profile.isScam = true;
          profile.confidence = conversation.confidence;
          profile.classificationReasoning = conversation.classificationReasoning || agentResult.scamReason;
          if (conversation.senderName && (!profile.senderName || profile.senderName === 'Unknown Attacker')) {
            profile.senderName = conversation.senderName;
          }

          if (currentThreatIntel) {
            // UPI IDs merge
            const upiMap = new Map();
            (profile.financialDetails?.upiIds || []).forEach(u => {
              const id = typeof u === 'string' ? u : u?.id;
              const conf = typeof u === 'object' && u?.confidence ? u.confidence : 'low';
              if (id) upiMap.set(id.toLowerCase(), { id, confidence: conf });
            });
            (currentThreatIntel.financialDetails?.upiIds || []).forEach(u => {
              const id = typeof u === 'string' ? u : u?.id;
              const conf = typeof u === 'object' && u?.confidence ? u.confidence : 'high';
              if (id) {
                const existing = upiMap.get(id.toLowerCase());
                if (!existing || (existing.confidence === 'low' && conf === 'high')) {
                  upiMap.set(id.toLowerCase(), { id, confidence: conf });
                }
              }
            });
            profile.financialDetails.upiIds = Array.from(upiMap.values());

            // Cards merge
            const cardSet = new Set([...(profile.financialDetails?.cards || []), ...(currentThreatIntel.financialDetails?.cards || [])]);
            profile.financialDetails.cards = Array.from(cardSet);

            // Bank accounts merge
            const newAccounts = currentThreatIntel.financialDetails?.bankAccounts || [];
            if (!profile.financialDetails.bankAccounts) profile.financialDetails.bankAccounts = [];
            newAccounts.forEach(newAcc => {
              if (newAcc.accountNumber && !profile.financialDetails.bankAccounts.some(acc => acc.accountNumber === newAcc.accountNumber)) {
                profile.financialDetails.bankAccounts.push(newAcc);
              }
            });

            // Links merge
            const newLinks = currentThreatIntel.links || [];
            if (!profile.links) profile.links = [];
            newLinks.forEach(newLink => {
              if (newLink.url && !profile.links.some(l => l.url.toLowerCase() === newLink.url.toLowerCase())) {
                profile.links.push(newLink);
              }
            });

            // Phone numbers merge
            const phoneSet = new Set([...(profile.attackerIdentifiers?.phoneNumbers || []), ...(currentThreatIntel.attackerIdentifiers?.phoneNumbers || [])]);
            profile.attackerIdentifiers.phoneNumbers = Array.from(phoneSet);

            // Aliases merge
            const aliasSet = new Set([...(profile.attackerIdentifiers?.aliases || []), ...(currentThreatIntel.attackerIdentifiers?.aliases || [])]);
            profile.attackerIdentifiers.aliases = Array.from(aliasSet);

            // Handles merge
            const handleSet = new Set([...(profile.attackerIdentifiers?.handles || []), ...(currentThreatIntel.attackerIdentifiers?.handles || [])]);
            profile.attackerIdentifiers.handles = Array.from(handleSet);
          }

          if (!profile.associatedChats.includes(chatId)) {
            profile.associatedChats.push(chatId);
          }

          // If honeypot finished its stalling lifecycle and confirmed scam, enforce permanent block
          if (agentResult.isConversationEnded) {
            profile.isBlocked = true;
            profile.blockedAt = profile.blockedAt || new Date();
            profile.blockReason = 'Autonomous Honeypot: Stalling complete and threat intel extracted';
            console.log(`🔒 [PERMANENT BLOCK APPLIED] Sender ${profile.senderName} (${profile.senderId}) is now permanently blocked.`);
          }

          profile.markModified('financialDetails');
          profile.markModified('attackerIdentifiers');
          profile.markModified('links');
          profile.markModified('associatedChats');

          await profile.save();
          console.log(`🚨 LIVE ALERT BROADCAST: Attacker Profile updated for ${profile.senderName}! Flagged UPIs: ${profile.financialDetails.upiIds.map(u => u.id).join(', ') || 'None'}`);
        } catch (err) {
          console.error('Error saving AttackerProfile:', err);
        }
      }

      // Optional live anti-fingerprinting delay: pauses response so Telegram sees genuine typing latency
      if (process.env.ENABLE_LIVE_DELAY === 'true' && conversation.simulatedHumanDelayMs > 0 && agentResult.reply) {
        console.log(`⏳ [Live Delay Active] Simulating human typing pause: ${conversation.simulatedHumanDelayMs}ms before sending reply...`);
        await new Promise(resolve => setTimeout(resolve, conversation.simulatedHumanDelayMs));
      }

      return {
        statusCode: 200,
        payload: {
          isKnownContact: false,
          reply: agentResult.reply,
          activePersona: conversation.activePersona,
          scamCategory: conversation.scamCategory,
          humanDelayMs: conversation.simulatedHumanDelayMs,
          endConversation: agentResult.isConversationEnded,
          isScam: conversation.isScam,
          isBlocked: Boolean(agentResult.isConversationEnded && conversation.isScam),
          confidence: conversation.confidence,
          classificationReasoning: conversation.classificationReasoning,
          threatIntelligence: currentThreatIntel,
          threatEnrichment: conversation.threatEnrichment
        }
      };
    });

    return res.status(result.statusCode).json(result.payload);
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
    let alerts = await AttackerProfile.find().sort({ updatedAt: -1, createdAt: -1 }).limit(50);
    
    // Fallback sync: If AttackerProfile is empty or missing, sync from flagged scam Conversations
    if (!alerts || alerts.length === 0) {
      const scamConvs = await Conversation.find({ isScam: true }).sort({ updatedAt: -1 }).limit(50);
      for (const conv of scamConvs) {
        let profile = await AttackerProfile.findOne({ senderId: conv.senderId });
        if (!profile) {
          profile = new AttackerProfile({
            senderId: conv.senderId,
            senderName: conv.senderName || 'Anonymous Scammer',
            isScam: true,
            confidence: conv.confidence || 0.9,
            classificationReasoning: conv.classificationReasoning || 'Flagged during honeypot dialogue',
            financialDetails: conv.threatIntelligence?.financialDetails || { upiIds: [], bankAccounts: [], cards: [] },
            links: conv.threatIntelligence?.links || [],
            attackerIdentifiers: conv.threatIntelligence?.attackerIdentifiers || { phoneNumbers: [], aliases: [], handles: [] },
            associatedChats: [conv.chatId]
          });
          await profile.save();
        }
      }
      alerts = await AttackerProfile.find().sort({ updatedAt: -1, createdAt: -1 }).limit(50);
    }

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
 * Retrieves all whitelisted known contacts.
 * GET /api/honeypot/contacts
 */
export const getKnownContacts = async (req, res) => {
  try {
    const contacts = await KnownContact.find().sort({ createdAt: -1 });
    return res.status(200).json(contacts);
  } catch (error) {
    console.error('Error in getKnownContacts controller:', error);
    return res.status(500).json({ error: 'An internal server error occurred while fetching contacts.' });
  }
};

/**
 * Removes a whitelisted contact by senderId.
 * DELETE /api/honeypot/contacts/:senderId
 */
export const deleteKnownContact = async (req, res) => {
  try {
    const { senderId } = req.params;
    const result = await KnownContact.findOneAndDelete({ senderId });
    if (!result) {
      return res.status(404).json({ error: 'Contact not found.' });
    }
    console.log(`Whitelisted contact removed: ${senderId} (${result.name})`);
    return res.status(200).json({ success: true, message: `Contact ${result.name} removed from whitelist.` });
  } catch (error) {
    console.error('Error in deleteKnownContact controller:', error);
    return res.status(500).json({ error: 'An internal server error occurred while removing the contact.' });
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

/**
 * Manually toggle block/unblock for a senderId.
 * POST /api/honeypot/block-toggle
 */
export const toggleBlockSender = async (req, res) => {
  try {
    const { senderId, block } = req.body;
    if (!senderId) {
      return res.status(400).json({ error: 'senderId is required.' });
    }

    let profile = await AttackerProfile.findOne({ senderId });
    if (!profile) {
      return res.status(404).json({ error: 'AttackerProfile not found for this senderId.' });
    }

    const newBlockState = block !== undefined ? Boolean(block) : !profile.isBlocked;
    profile.isBlocked = newBlockState;
    if (newBlockState) {
      profile.blockedAt = new Date();
      profile.blockReason = 'Manually blocked by SOC Analyst from Honeypot Console';
    } else {
      profile.blockReason = 'Unblocked by SOC Analyst';
    }

    await profile.save();
    console.log(`[Block Toggle] SenderId ${senderId} is now ${newBlockState ? 'BLOCKED 🚫' : 'UNBLOCKED 🟢'}`);

    return res.status(200).json({
      success: true,
      senderId,
      isBlocked: profile.isBlocked,
      blockedAttemptsCount: profile.blockedAttemptsCount || 0,
      blockReason: profile.blockReason
    });
  } catch (error) {
    console.error('Error in toggleBlockSender controller:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while updating block status.'
    });
  }
};
