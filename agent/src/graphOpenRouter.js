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

// Helper to call OpenRouter with fast Llama/Qwen models and 8s timeout
export async function callOpenRouter({ model, messages, temperature = 0.6 }) {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY environment variable is not defined in .env");
  }

  const primaryModel = model || process.env.OPENROUTER_MAIN_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const candidateModels = [
    primaryModel,
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "nvidia/nemotron-3.5-lightning:free"
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError = null;

  for (const currentModel of candidateModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(8000), // 8-second max per attempt
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://honeypot.local",
          "X-Title": "Honeypot Security System",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: currentModel,
          messages,
          temperature
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[OpenRouter ${currentModel} status ${response.status}]: ${errorText}`);
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      if (data.error) {
        console.warn(`[OpenRouter ${currentModel} returned error]:`, data.error.message || data.error);
        lastError = new Error(data.error.message || JSON.stringify(data.error));
        continue;
      }

      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        const content = choice.message?.content || choice.text || "";
        if (content) {
          return content;
        }
      }
    } catch (err) {
      console.warn(`[OpenRouter ${currentModel} error/timeout]:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All OpenRouter free models failed to respond.");
}

// 2. Combined Node: Scam Scoring + Persona Reply in a SINGLE LLM Call (2x Faster)
async function processTurnNode(state) {
  try {
    const systemPrompt = `${PERSONA.systemPrompt}

---
CRITICAL INSTRUCTION:
Simultaneously evaluate the incoming scam risk AND generate Kamla Devi's next in-character response.

You MUST reply ONLY with a raw JSON object matching this exact format:
{
  "scamScore": <number between 0 and 10, where 0=safe, 10=definite scam>,
  "scamReason": "<single concise sentence explaining the threat reasoning>",
  "reply": "<Kamla Devi's naive, stalling response in character>"
}
Do not write markdown backticks or any other text outside the JSON object.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...state.messages.map(m => ({
        role: (m.role === 'user' || m.role === 'attacker' || m.role === 'human') ? 'user' : 'assistant',
        content: m.content || m.text || ''
      }))
    ];

    console.log(`[OpenRouter 1-Pass] Evaluating score & reply for chatId: ${state.chatId}...`);
    const rawContent = await callOpenRouter({
      messages: formattedMessages,
      temperature: 0.6
    });

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const scamScore = typeof parsed.scamScore === 'number' ? parsed.scamScore : (typeof parsed.score === 'number' ? parsed.score : 3);
      const scamReason = parsed.scamReason || parsed.reasoning || "Evaluated conversation indicators.";
      const reply = parsed.reply || "Beta, my phone screen is flickering. What were you saying?";

      console.log(`Turn result → Score: ${scamScore}/10 ("${scamReason}")`);
      console.log(`Kamla Devi: "${reply}"`);

      return {
        scamScore,
        scamReason,
        reply,
        messages: [{ role: 'assistant', content: reply }]
      };
    }

    // Fallback if JSON format was loose
    const cleanText = rawContent.replace(/```json|```/g, '').trim();
    return {
      scamScore: 4,
      scamReason: "Conversation progressing.",
      reply: cleanText,
      messages: [{ role: 'assistant', content: cleanText }]
    };

  } catch (error) {
    console.error("Error in processTurnNode:", error.message);
    const fallbackReply = "Oh dear, my phone is acting up again. What did you say, dear?";
    return {
      scamScore: 3,
      scamReason: "Fallback scoring due to service error.",
      reply: fallbackReply,
      messages: [{ role: 'assistant', content: fallbackReply }]
    };
  }
}

// 3. Classification & Intel Extraction (only triggers on disengagement / high threat)
async function classificationNode(state) {
  console.log(`[OpenRouter] Classification triggered for chatId: ${state.chatId}`);

  try {
    const transcriptText = state.messages
      .map(m => `${(m.role === 'user' || m.role === 'attacker') ? 'Attacker' : 'Kamla Devi'}: ${m.content || m.text}`)
      .join('\n');

    const classificationPrompt = [
      {
        role: "system",
        content: `You are an expert fraud analyst. Review the transcript between an attacker and Kamla Devi (honeypot persona). Classify whether the attacker is attempting a scam.\n\nRespond ONLY with a valid raw JSON object: {"isScam": true/false, "confidence": <0 to 1>, "reasoning": "<detailed reasoning>"}. Do not include markdown code blocks.`
      },
      {
        role: "user",
        content: `Transcript:\n${transcriptText}`
      }
    ];

    console.log("[OpenRouter] Running final classification...");
    const rawClassify = await callOpenRouter({
      messages: classificationPrompt,
      temperature: 0.1
    });

    let isScam = true;
    let confidence = 0.95;
    let reasoning = "Suspected fraudulent communication pattern.";

    const jsonMatch = rawClassify.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        isScam = Boolean(parsed.isScam);
        confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9;
        reasoning = parsed.reasoning || reasoning;
      } catch (e) {
        console.warn("JSON parse warning in classification:", e.message);
      }
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

      disengagementReply = await callOpenRouter({
        messages: [
          { role: "system", content: PERSONA.systemPrompt },
          { role: "user", content: goodbyePrompt }
        ],
        temperature: 0.7
      });
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
    console.error("Error in classificationNode:", error.message);
    return {
      isConversationEnded: true,
      isScam: state.scamScore >= 6,
      confidence: 0.8,
      classificationReasoning: "Fallback classification due to system error.",
      threatIntelligence: null,
      reply: "Let me ask my grandson Aarav about this first, beta. I'll get back to you."
    };
  }
}

// 4. Conditional router
function routeConversation(state) {
  const maxTurns = 15;
  console.log(`Routing → Turn: ${state.turnCount}/${maxTurns}, Score: ${state.scamScore}`);

  if (state.turnCount >= maxTurns || state.scamScore >= 8) {
    console.log("Terminal conditions met. Routing to classification.");
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


