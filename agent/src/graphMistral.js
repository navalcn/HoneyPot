import { ChatMistralAI } from "@langchain/mistralai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { z } from "zod";
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

// Helper to identify human (attacker) messages across plain objects and LangChain classes
const isHumanMessage = (m) => {
  if (!m) return false;
  const role = (m.role || '').toLowerCase();
  if (role === 'user' || role === 'human' || role === 'attacker') return true;
  if (typeof m._getType === 'function' && m._getType() === 'human') return true;
  if (m.constructor?.name === 'HumanMessage') return true;
  return false;
};

// Helper to initialize Mistral Chat model
const getModel = () => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY environment variable is not defined.");
  }
  return new ChatMistralAI({
    model: process.env.MISTRAL_MODEL || "mistral-large-latest",
    apiKey: apiKey,
    temperature: 0.7,
  });
};

// 2. Node: Score the current turn for scam-likelihood
async function scoreTurnNode(state) {
  try {
    const model = getModel();

    // Define structure for scam score output
    const scoreSchema = z.object({
      score: z.number().min(0).max(10).describe("Scam-likelihood score from 0 (safe) to 10 (obvious scam)"),
      reasoning: z.string().describe("A brief, single-sentence reasoning for the score")
    });

    const structuredModel = model.withStructuredOutput(scoreSchema);

    // Format the messages for the LangChain agent
    const formattedMessages = [
      new SystemMessage(PERSONA.scoringPrompt),
      ...state.messages.map(m => {
        return isHumanMessage(m) ? new HumanMessage(m.content) : new AIMessage(m.content);
      })
    ];

    console.log(`Scoring last message for chatId: ${state.chatId}...`);
    const result = await structuredModel.invoke(formattedMessages);

    console.log(`Turn score: ${result.score}/10, Reason: "${result.reasoning}"`);

    return {
      scamScore: result.score,
      scamReason: result.reasoning
    };
  } catch (error) {
    console.error("Error in scoreTurnNode:", error);
    return {
      scamScore: 3,
      scamReason: "Fallback scoring due to service error."
    };
  }
}

// 3. Node: Generate conversational reply in character (Margaret persona)
async function generateReplyNode(state) {
  try {
    const model = getModel();

    const formattedMessages = [
      new SystemMessage(PERSONA.systemPrompt),
      ...state.messages.map(m => {
        return isHumanMessage(m) ? new HumanMessage(m.content) : new AIMessage(m.content);
      })
    ];

    console.log(`Generating persona reply for chatId: ${state.chatId}...`);
    const response = await model.invoke(formattedMessages);
    const replyText = response.content;

    return {
      reply: replyText,
      // Add the new message to state message history
      messages: [new AIMessage(replyText)]
    };
  } catch (error) {
    console.error("Error in generateReplyNode:", error);
    return {
      reply: "Oh dear, my phone is acting up again. What did you say, dear?"
    };
  }
}

// 4. Node: Classification & Intel Extraction (disengagement node)
async function classificationNode(state) {
  console.log(`Honeypot conversation classification triggered for chatId: ${state.chatId}`);
  
  try {
    const model = getModel();

    // Schema for final classification
    const classificationSchema = z.object({
      isScam: z.boolean().describe("Whether this conversation is verified to be a scam"),
      confidence: z.number().min(0).max(1).describe("Confidence score of classification from 0 to 1"),
      reasoning: z.string().describe("Detailed reasoning for this classification based on the transcript")
    });

    const structuredModel = model.withStructuredOutput(classificationSchema);

    // Build the transcript text
    const transcriptText = state.messages
      .map(m => `${isHumanMessage(m) ? 'Attacker' : 'Kamla Devi'}: ${m.content}`)
      .join('\n');

    const classificationPrompt = [
      new SystemMessage("You are an expert fraud analyst. Review the full transcript of this conversation between an attacker (who contacted a honeypot) and Kamla Devi (the honeypot persona). Classify whether the attacker is attempting a scam."),
      new HumanMessage(`Transcript:\n${transcriptText}`)
    ];

    console.log("Analyzing transcript for final classification...");
    const result = await structuredModel.invoke(classificationPrompt);
    console.log(`Classification result -> isScam: ${result.isScam}, Confidence: ${result.confidence}`);

    let threatIntel = null;
    if (result.isScam) {
      // Convert messages to turns formatting for the extraction utility
      const turnsForExtraction = state.messages.map(m => ({
        role: isHumanMessage(m) ? 'attacker' : 'honeypot',
        text: m.content
      }));

      // Extract details in parallel with regex fallbacks
      threatIntel = await extractAllThreatIntel(turnsForExtraction);
    }

    // Generate in-character disengagement text
    let disengagementReply = "";
    try {
      const goodbyePrompt = result.isScam
        ? "Generate a short, final sentence in the character of an elderly Indian grandmother Kamla Devi making an excuse to disengage and consult her computer-savvy grandson, Aarav. E.g., 'Beta, my tea is ready, let me ask Aarav about this and get back to you!'"
        : "Generate a short, final sentence in the character of an elderly Indian grandmother Kamla Devi politely saying she will have her family handle this chat instead. E.g., 'I will let my son handle this chat, beta!'";

      const response = await model.invoke([
        new SystemMessage(PERSONA.systemPrompt),
        new HumanMessage(goodbyePrompt)
      ]);
      disengagementReply = response.content;
    } catch (error) {
      disengagementReply = result.isScam
        ? "Let me ask my grandson Aarav about this first, beta. I'll get back to you."
        : "I'll let my family take over this chat now. Goodbye!";
    }

    return {
      isConversationEnded: true,
      isScam: result.isScam,
      confidence: result.confidence,
      classificationReasoning: result.reasoning,
      threatIntelligence: threatIntel,
      reply: disengagementReply,
      messages: [new AIMessage(disengagementReply)]
    };

  } catch (error) {
    console.error("Error in classificationNode:", error);
    return {
      isConversationEnded: true,
      isScam: state.scamScore >= 6,
      confidence: 0.7,
      classificationReasoning: "Fallback classification due to system error.",
      threatIntelligence: null,
      reply: "Let me ask my grandson Aarav about this first, beta. I'll get back to you."
    };
  }
}

// 5. Conditional router edge logic
function routeConversation(state) {
  const maxTurns = 15;
  
  console.log(`Routing evaluation -> Turn Count: ${state.turnCount}/${maxTurns}, Current Turn Scam Score: ${state.scamScore}`);

  if (state.turnCount >= maxTurns) {
    console.log("Hard turn cap reached. Routing to classification.");
    return "classify";
  }

  if (state.scamScore >= 8) {
    console.log("High scam score detected. Routing to classification.");
    return "classify";
  }

  return "reply";
}

// 6. Build the State Graph
const graphBuilder = new StateGraph(AgentState)
  .addNode("scoreTurn", scoreTurnNode)
  .addNode("generateReply", generateReplyNode)
  .addNode("classification", classificationNode)
  
  .addEdge(START, "scoreTurn")
  .addConditionalEdges("scoreTurn", routeConversation, {
    reply: "generateReply",
    classify: "classification"
  })
  .addEdge("generateReply", END)
  .addEdge("classification", END);

// Compile the executable graph
const honeypotGraph = graphBuilder.compile();

/**
 * Runner function invoked by the Express controller.
 */
export const runHoneypotAgent = async ({ chatId, turns, turnCount }) => {
  // Convert db turns into agent-compatible messages format
  const messages = turns.map(t => ({
    role: t.role === "attacker" ? "user" : "assistant",
    content: t.text
  }));

  // Use the explicit attacker-turn counter passed from the controller (Issue 3).
  // Fallback to Math.ceil for safety if called without it (e.g. tests).
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
