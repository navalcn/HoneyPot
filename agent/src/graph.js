import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { PERSONA } from "./config/persona.js";

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
  })
});

// Helper to initialize Gemini Chat model
const getModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined.");
  }
  return new ChatGoogleGenerativeAI({
    model: "gemini-3.5-flash",
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
        if (m.role === 'user') return new HumanMessage(m.content);
        return new AIMessage(m.content);
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
    // Fallback in case of classification API issues
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
        if (m.role === 'user') return new HumanMessage(m.content);
        return new AIMessage(m.content);
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

// 4. Node: Classification (disengagement node)
async function classificationNode(state) {
  console.log(`Honeypot conversation classification triggered for chatId: ${state.chatId}`);
  
  const isScam = state.scamScore >= 6;
  const confidence = isScam ? Math.min(state.scamScore / 10 + 0.1, 0.95) : 0.7;

  // Let the LLM generate a natural, in-character disengagement text
  let disengagementReply = "";
  try {
    const model = getModel();
    const disengagementPrompt = isScam
      ? "Generate a short, final sentence in the character of an elderly grandmother Margaret making an excuse to disengage and consult her computer-savvy grandson, Billy. E.g., 'Oh, my soup is boiling over, let me ask Billy about this and get back to you!'"
      : "Generate a short, final sentence in the character of an elderly grandmother Margaret politely saying she will have her family handle this chat instead. E.g., 'I will let my daughter handle this chat, thank you!'";

    const response = await model.invoke([
      new SystemMessage(PERSONA.systemPrompt),
      new HumanMessage(disengagementPrompt)
    ]);
    disengagementReply = response.content;
  } catch (error) {
    disengagementReply = isScam
      ? "Let me ask my grandson Billy about this first, dear. I'll get back to you."
      : "I'll let my family take over this chat now. Goodbye!";
  }

  return {
    isConversationEnded: true,
    isScam,
    confidence,
    reply: disengagementReply,
    messages: [new AIMessage(disengagementReply)]
  };
}

// 5. Conditional router edge logic
function routeConversation(state) {
  // Check if we hit the hard cap of 15 turns, or if threat level is high
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
 * Runs the graph to process a new message turn.
 * @param {Object} params Input parameters
 * @param {string} params.chatId Unique identifier for conversation
 * @param {Array} params.turns Full list of existing mongoose turns in format { role, text, timestamp }
 * @returns {Promise<Object>} Agent outputs (reply, scamScore, scamReason, isScam, confidence, isConversationEnded)
 */
export const runHoneypotAgent = async ({ chatId, turns }) => {
  // Convert db turns into agent-compatible messages format
  const messages = turns.map(t => ({
    role: t.role === "attacker" ? "user" : "assistant",
    content: t.text
  }));

  // turnCount represents pairs of dialog steps (approximate engagement turns)
  const turnCount = Math.ceil(turns.length / 2);

  const responseState = await honeypotGraph.invoke({
    chatId,
    messages,
    turnCount,
  });

  return {
    reply: responseState.reply,
    scamScore: responseState.scamScore,
    scamReason: responseState.scamReason,
    isConversationEnded: responseState.isConversationEnded,
    isScam: responseState.isScam,
    confidence: responseState.confidence
  };
};
