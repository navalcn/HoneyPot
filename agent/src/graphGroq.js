import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { PERSONA } from "./config/persona.js";
import { extractAllThreatIntel } from "./utils/extractor.js";

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

// 2. Single-Pass Turn: Score + Kamla Devi Persona reply in ONE fast Groq request
async function processTurnNode(state) {
  try {
    const systemPrompt = `${PERSONA.systemPrompt}

---
CRITICAL OPERATIONAL INSTRUCTIONS:
1. First, evaluate the latest user message in conversation context for scam / fraud risk (0 to 10 scale).
2. SILENT MODE RULE: If the user's message is merely a generic greeting (e.g., "Hi", "Hello", "Hey", "How are you", "test") with NO scam, NO offer, NO financial request, and NO suspicious intent (scamScore <= 2):
   - Set "reply": null.
   - Do NOT generate any greeting or text. Stay silent until they state a purpose.
3. ENGAGEMENT RULE: If the message contains ANY suspicious proposal, job offer, lottery, bill threat, KYC demand, link, or money request (scamScore >= 3):
   - Set "reply" to Kamla Devi's naive, stalling response in character.
4. STRICT NON-REPETITION: Carefully read the transcript history. NEVER repeat the same question or excuse you already sent earlier. React dynamically to the scammer's latest step (e.g., feign opening the app, report a fake payment error to ask for backup UPI/QR, ask about buttons/PIN).

You MUST respond strictly with a valid JSON object matching this schema:
{
  "scamScore": <number between 0 (safe) and 10 (definite scam)>,
  "scamReason": "<single concise sentence explaining why it is or is not a scam>",
  "reply": "<Kamla Devi's stalling response string OR null if purely a neutral greeting>"
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
    const scamReason = parsed.scamReason || "Evaluated conversation indicators.";
    
    // If score <= 2 or explicitly null, enforce silent mode (reply = null)
    let reply = parsed.reply;
    if (scamScore <= 2 || reply === "null" || reply === null || reply === "") {
      reply = null;
    }

    console.log(`[Groq Turn Result] Score: ${scamScore}/10 | Reason: "${scamReason}"`);
    console.log(`[Kamla Devi Reply]: ${reply ? `"${reply}"` : '(Silent Mode - No reply sent)'}`);

    return {
      scamScore,
      scamReason,
      reply,
      messages: reply ? [{ role: 'assistant', content: reply }] : []
    };
  } catch (error) {
    console.error("Error in Groq processTurnNode:", error.message);
    return {
      scamScore: 3,
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
    scamReason: responseState.scamReason,
    isConversationEnded: responseState.isConversationEnded,
    isScam: responseState.isScam,
    confidence: responseState.confidence,
    classificationReasoning: responseState.classificationReasoning,
    threatIntelligence: responseState.threatIntelligence
  };
};
