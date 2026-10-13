import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { PERSONAS } from "./config/persona.js";
import { extractAllThreatIntel } from "./utils/extractor.js";
import { calculateHumanDelay, injectHumanTypos } from "./utils/antiFingerprint.js";

// 1. Define the conversation state schema
export const AgentState = Annotation.Root({
  chatId: Annotation({
    reducer: (x, y) => y ?? x,
  }),
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  turnCount: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  scamScore: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  scamCategory: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "general_fraud",
  }),
  activePersona: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "KAMLA_DEVI",
  }),
  humanDelayMs: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  scamReason: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  reply: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  isConversationEnded: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  isScam: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  confidence: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  classificationReasoning: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  threatIntelligence: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  })
});

// Helper to call Groq API directly (Ultra-fast LPU inference, <500ms)
export async function callGroq({ model, messages, temperature = 0.6 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not defined in .env");
  }

  const modelToUse = model || process.env.GROQ_MAIN_MODEL || "openai/gpt-oss-20b";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelToUse,
      messages,
      temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Groq API Error ${response.status}]:`, errorText);
    throw new Error(`Groq API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Groq returned no choices in response");
  }

  return data.choices[0].message.content;
}

// Helper to determine persona based on category or state
function resolvePersona(category, currentPersonaId) {
  if (currentPersonaId && PERSONAS[currentPersonaId] && category === "general_fraud") {
    return PERSONAS[currentPersonaId];
  }
  if (category === "job_offer" || category === "part_time_task" || category === "youtube_rating" || category === "work_from_home") {
    return PERSONAS.ROHAN_SHARMA;
  }
  if (category === "crypto_investment" || category === "forex_trading" || category === "stock_tips") {
    return PERSONAS.RAJESH_UNCLE;
  }
  return PERSONAS.KAMLA_DEVI;
}

// 2. Single-Pass Turn: Scam Category + Score + Dynamic Persona Reply in ONE fast Groq request
async function processTurnNode(state) {
  try {
    const currentPersona = PERSONAS[state.activePersona] || PERSONAS.KAMLA_DEVI;

    const systemPrompt = `You are an AI-driven deceptive honeypot defense system with multiple adaptive personas.
Available Personas:
1. KAMLA_DEVI: 65yo elderly teacher in Jaipur. Naive, gullible, polite, frightened by official threats (electricity bills, KYC, bank cards, fines).
2. ROHAN_SHARMA: 21yo broke engineering student in Delhi. Eager for part-time income, quick cash, task scams, YouTube rating gigs. Uses slang like 'bro', 'bhai', 'yaar'.
3. RAJESH_UNCLE: 52yo textile shopkeeper in Surat. Interested in crypto/forex/stock tips for high returns, slightly cautious but tempted.

Active Default Persona: ${currentPersona.name}
Active Persona Directive:
${currentPersona.systemPrompt}

---
CRITICAL OPERATIONAL INSTRUCTIONS:
1. Classify the message into "scamCategory": ["job_offer", "part_time_task", "authority_threat", "electricity_bill", "bank_kyc", "crypto_investment", "lottery", "general_fraud", "benign"].
2. Select the optimal "activePersona":
   - "ROHAN_SHARMA" for job, task, work-from-home, YouTube rating scams.
   - "RAJESH_UNCLE" for crypto, stock, investment, trading scams.
   - "KAMLA_DEVI" for bill threats, authority, bank KYC, card blocking, or general fraud.
3. Score scam / fraud risk from 0 to 10 ("scamScore").
4. SILENT MODE RULE: If the user's message is merely a generic greeting (e.g., "Hi", "Hello", "test") with NO scam intent (scamScore <= 2):
   - Set "reply": null. Stay silent until purpose is revealed.
5. ENGAGEMENT RULE: If scamScore >= 3:
   - Provide an in-character stalling reply matching the selected "activePersona".
   - Never say you are an AI, honeypot, or bot.
   - React dynamically to the scammer's latest step (feign app confusion, fake payment errors, ask for backup UPI/QR).

You MUST respond strictly with a valid JSON object matching this schema:
{
  "scamScore": <number 0-10>,
  "scamCategory": "<category_string>",
  "activePersona": "<KAMLA_DEVI | ROHAN_SHARMA | RAJESH_UNCLE>",
  "scamReason": "<single concise sentence explaining the indicator>",
  "reply": "<persona stalling reply string OR null if neutral greeting>"
}`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...state.messages.map(m => ({
        role: (m.role === 'user' || m.role === 'attacker' || m.role === 'human') ? 'user' : 'assistant',
        content: m.content || m.text || ''
      }))
    ];

    console.log(`[Groq LPU] Processing turn for chatId: ${state.chatId}...`);
    const rawContent = await callGroq({
      messages: formattedMessages,
      temperature: 0.6
    });

    const parsed = JSON.parse(rawContent);
    const scamScore = typeof parsed.scamScore === 'number' ? parsed.scamScore : 3;
    const scamCategory = parsed.scamCategory || "general_fraud";
    const selectedPersonaId = (parsed.activePersona && PERSONAS[parsed.activePersona]) ? parsed.activePersona : (state.activePersona || "KAMLA_DEVI");
    const scamReason = parsed.scamReason || "Evaluated conversation indicators.";
    
    // If score <= 2 or explicitly null, enforce silent mode
    let reply = parsed.reply;
    if (scamScore <= 2 || reply === "null" || reply === null || reply === "") {
      reply = null;
    }

    // Apply Anti-Fingerprinting (2.B): Human typo injection & typing latency calculation
    let humanDelayMs = 0;
    if (reply) {
      reply = injectHumanTypos(reply, 0.22);
      humanDelayMs = calculateHumanDelay(reply, selectedPersonaId);
    }

    console.log(`[Groq Turn Result] Score: ${scamScore}/10 | Category: ${scamCategory} | Persona: ${selectedPersonaId}`);
    console.log(`[Anti-Fingerprint] Simulated Typing Latency: ${humanDelayMs}ms`);
    console.log(`[Persona Reply]: ${reply ? `"${reply}"` : '(Silent Mode - No reply sent)'}`);

    return {
      scamScore,
      scamCategory,
      activePersona: selectedPersonaId,
      humanDelayMs,
      scamReason,
      reply,
      messages: reply ? [{ role: 'assistant', content: reply }] : []
    };
  } catch (error) {
    console.error("Error in Groq processTurnNode:", error.message);
    return {
      scamScore: 3,
      scamCategory: "general_fraud",
      activePersona: state.activePersona || "KAMLA_DEVI",
      humanDelayMs: 0,
      scamReason: "Fallback scoring due to service error.",
      reply: null,
      messages: []
    };
  }
}


// 3. Classification & Intel Extraction (triggered on disengagement)
async function classificationNode(state) {
  console.log(`[Groq] Classification triggered for chatId: ${state.chatId}`);

  try {
    const transcriptText = state.messages
      .map(m => `${(m.role === 'user' || m.role === 'attacker') ? 'Attacker' : 'Kamla Devi'}: ${m.content || m.text}`)
      .join('\n');

    const classificationPrompt = [
      {
        role: "system",
        content: `You are an expert cybersecurity fraud analyst. Review the transcript between an attacker and Kamla Devi (honeypot persona). Classify whether the attacker is attempting a scam.
Respond ONLY with a valid JSON object:
{"isScam": true/false, "confidence": <0.0 to 1.0>, "reasoning": "<detailed reasoning>"}`
      },
      {
        role: "user",
        content: `Transcript:\n${transcriptText}`
      }
    ];

    console.log("[Groq] Running final classification...");
    const rawClassify = await callGroq({
      model: process.env.GROQ_MAIN_MODEL || "openai/gpt-oss-20b",
      messages: classificationPrompt,
      temperature: 0.1
    });

    let isScam = true;
    let confidence = 0.95;
    let reasoning = "Suspected fraudulent communication pattern.";

    try {
      const parsed = JSON.parse(rawClassify);
      isScam = Boolean(parsed.isScam);
      confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9;
      reasoning = parsed.reasoning || reasoning;
    } catch (e) {
      console.warn("JSON parse warning in classification:", e.message);
    }

    console.log(`Classification → isScam: ${isScam}, Confidence: ${confidence}`);

    let threatIntel = null;
    if (isScam) {
      const turnsForExtraction = state.messages.map(m => ({
        role: (m.role === 'user' || m.role === 'attacker') ? 'attacker' : 'honeypot',
        text: m.content || m.text || ''
      }));
      threatIntel = await extractAllThreatIntel(turnsForExtraction);
    }

    // Generate in-character disengagement line
    let disengagementReply = "";
    try {
      const goodbyePrompt = isScam
        ? "Generate one short final sentence as Kamla Devi making an excuse to disengage and consult her grandson Aarav. Example: 'Beta, my tea is ready, let me ask Aarav about this!'"
        : "Generate one short final sentence as Kamla Devi politely saying her family will handle this chat.";

      const rawGoodbye = await callGroq({
        messages: [
          { role: "system", content: PERSONA.systemPrompt + "\nRespond with JSON: {\"reply\": \"<sentence>\"}" },
          { role: "user", content: goodbyePrompt }
        ],
        temperature: 0.7
      });
      const parsedGoodbye = JSON.parse(rawGoodbye);
      disengagementReply = parsedGoodbye.reply || "Let me ask my grandson Aarav about this first, beta.";
    } catch {
      disengagementReply = isScam
        ? "Let me ask my grandson Aarav about this first, beta. I'll get back to you."
        : "I'll let my family take over this chat now. Goodbye!";
    }

    return {
      isConversationEnded: true,
      isScam,
      confidence,
      classificationReasoning: reasoning,
      threatIntelligence: threatIntel,
      reply: disengagementReply,
      messages: [{ role: 'assistant', content: disengagementReply }]
    };

  } catch (error) {
    console.error("Error in Groq classificationNode:", error.message);
    return {
      isConversationEnded: true,
      isScam: state.scamScore >= 6,
      confidence: 0.8,
      classificationReasoning: "Fallback classification due to service error.",
      threatIntelligence: null,
      reply: "Let me ask my grandson Aarav about this first, beta. I'll get back to you."
    };
  }
}

// 4. Conditional router
function routeConversation(state) {
  const maxTurns = 12;
  console.log(`Routing → Turn: ${state.turnCount}/${maxTurns}, Score: ${state.scamScore}`);

  // Disengage and classify only when conversation reaches max turns (12 turns)
  if (state.turnCount >= maxTurns) {
    console.log("Max turns reached. Routing to final classification & disengagement.");
    return "classify";
  }
  return "end";
}


// 5. Build the State Graph
const graphBuilder = new StateGraph(AgentState)
  .addNode("processTurn", processTurnNode)
  .addNode("classification", classificationNode)
  .addEdge(START, "processTurn")
  .addConditionalEdges("processTurn", routeConversation, {
    classify: "classification",
    end: END
  })
  .addEdge("classification", END);

const honeypotGraph = graphBuilder.compile();

/**
 * Runner function invoked by the Express controller.
 */
export const runHoneypotAgent = async ({ chatId, turns, turnCount }) => {
  const messages = turns.map(t => ({
    role: t.role === "attacker" ? "user" : "assistant",
    content: t.text
  }));

  const resolvedTurnCount = turnCount ?? Math.ceil(turns.length / 2);

  const responseState = await honeypotGraph.invoke({
    chatId,
    messages,
    turnCount: resolvedTurnCount,
  });

  return {
    reply: responseState.reply,
    scamScore: responseState.scamScore,
    scamCategory: responseState.scamCategory,
    activePersona: responseState.activePersona,
    humanDelayMs: responseState.humanDelayMs,
    scamReason: responseState.scamReason,
    isConversationEnded: responseState.isConversationEnded,
    isScam: responseState.isScam,
    confidence: responseState.confidence,
    classificationReasoning: responseState.classificationReasoning,
    threatIntelligence: responseState.threatIntelligence
  };
};
