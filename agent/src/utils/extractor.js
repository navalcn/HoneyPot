import { ChatMistralAI } from "@langchain/mistralai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

// Initialize Mistral extraction model (low temperature for structured consistency)
const getExtractionModel = () => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY environment variable is not defined.");
  }
  return new ChatMistralAI({
    model: process.env.MISTRAL_MODEL || "mistral-large-latest",
    apiKey: apiKey,
    temperature: 0,
  });
};

// 1. Zod Schema for Financial Details
const financialSchema = z.object({
  upiIds: z.array(z.string()).default([]).describe("Unified Payment Interface (UPI) IDs (e.g. payer@bank)"),
  bankAccounts: z.array(z.object({
    accountNumber: z.string().describe("Bank account number"),
    ifsc: z.string().describe("IFSC code (Indian Financial System Code)"),
    bankName: z.string().default("Unknown").describe("Name of the bank")
  })).default([]).describe("Bank account details provided by the attacker"),
  cards: z.array(z.string()).default([]).describe("Credit/Debit card details (numbers, card names)")
});

// 2. Zod Schema for Links
const linkSchema = z.object({
  links: z.array(z.object({
    url: z.string().describe("Full URL"),
    domain: z.string().describe("Root domain name of the link"),
    description: z.string().default("").describe("Brief context of what this link is for")
  })).default([]).describe("Links, web portals, or phishing URLs shared by the attacker")
});

// 3. Zod Schema for Attacker Identifiers
const attackerSchema = z.object({
  phoneNumbers: z.array(z.string()).default([]).describe("Phone numbers shared or mentioned by the attacker"),
  aliases: z.array(z.string()).default([]).describe("Aliases, names, handles, or display names used by the attacker"),
  handles: z.array(z.string()).default([]).describe("Social media handles, Telegram handles starting with @, or usernames")
});

/**
 * Invokes Gemini structured tool calling to extract financial details
 */
async function extractFinancialDetails(transcript) {
  try {
    const model = getExtractionModel().withStructuredOutput(financialSchema);
    const prompt = [
      new SystemMessage("You are a cybersecurity threat analyst. Analyze the conversation transcript and extract any financial identifiers: UPI IDs, bank accounts (account number, IFSC code, bank name), and credit/debit card details."),
      new HumanMessage(`Conversation Transcript:\n${transcript}`)
    ];
    return await model.invoke(prompt);
  } catch (error) {
    console.error("Error extracting financial details:", error);
    return { upiIds: [], bankAccounts: [], cards: [] };
  }
}

/**
 * Invokes Gemini structured tool calling to extract URLs/Links
 */
async function extractLinks(transcript) {
  try {
    const model = getExtractionModel().withStructuredOutput(linkSchema);
    const prompt = [
      new SystemMessage("You are a cybersecurity threat analyst. Analyze the conversation transcript and extract any URLs, links, or web domains shared by the attacker. Do not extract standard search engines or standard social network domains (like t.me) unless they point to a phishing group."),
      new HumanMessage(`Conversation Transcript:\n${transcript}`)
    ];
    return await model.invoke(prompt);
  } catch (error) {
    console.error("Error extracting links:", error);
    return { links: [] };
  }
}

/**
 * Invokes Gemini structured tool calling to extract phone numbers/aliases/handles
 */
async function extractAttackerIdentifiers(transcript) {
  try {
    const model = getExtractionModel().withStructuredOutput(attackerSchema);
    const prompt = [
      new SystemMessage("You are a cybersecurity threat analyst. Analyze the conversation transcript and extract any attacker identifiers: phone numbers, usernames, aliases, display names, and social media handles (especially Telegram handles starting with @)."),
      new HumanMessage(`Conversation Transcript:\n${transcript}`)
    ];
    return await model.invoke(prompt);
  } catch (error) {
    console.error("Error extracting attacker identifiers:", error);
    return { phoneNumbers: [], aliases: [], handles: [] };
  }
}

/**
 * Helper to parse domains out of raw URLs
 */
const getDomain = (urlStr) => {
  try {
    if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
      urlStr = "http://" + urlStr;
    }
    const url = new URL(urlStr);
    return url.hostname.replace("www.", "").toLowerCase();
  } catch (e) {
    const match = urlStr.match(/^(?:https?:\/\/)?(?:www\.)?([^\s\/]+)/);
    return match ? match[1].toLowerCase() : urlStr.toLowerCase();
  }
};

/**
 * Orchestrates parallel Mistral extraction and applies regex fallbacks/normalizations
 * @param {Array} turns Array of conversation turns { role, text }
 * @returns {Promise<Object>} Consolidated, normalized threat intelligence JSON record
 */
export const extractAllThreatIntel = async (turns) => {
  const transcriptText = turns
    .map(t => `${t.role === 'attacker' ? 'Attacker' : 'Kamla Devi'}: ${t.text}`)
    .join('\n');

  console.log("Running parallel threat intelligence extraction...");

  // 1. Run LLM extractions in parallel
  const [financials, linkData, identifiers] = await Promise.all([
    extractFinancialDetails(transcriptText),
    extractLinks(transcriptText),
    extractAttackerIdentifiers(transcriptText)
  ]);

  // Ensure default structures are safe
  const upiIds = new Set(financials.upiIds || []);
  const bankAccounts = financials.bankAccounts || [];
  const cards = new Set(financials.cards || []);
  const links = linkData.links || [];
  const phoneNumbers = new Set(identifiers.phoneNumbers || []);
  const aliases = new Set(identifiers.aliases || []);
  const handles = new Set(identifiers.handles || []);

  // 2. Regex fallbacks (to guarantee we catch pattern matches)
  const rawText = turns.map(t => t.text).join(' ');

  // Regex: UPI ID (e.g. payinguser@okaxis)
  const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;
  const upiMatches = rawText.match(upiRegex);
  if (upiMatches) {
    upiMatches.forEach(match => upiIds.add(match.trim().toLowerCase()));
  }

  // Regex: URLs
  const urlRegex = /https?:\/\/[^\s\/\?#]+\.[^\s\/\?#]+[^\s]*/gi;
  const urlMatches = rawText.match(urlRegex);
  if (urlMatches) {
    urlMatches.forEach(url => {
      const trimmedUrl = url.trim();
      const domain = getDomain(trimmedUrl);
      
      // If LLM didn't capture this URL, append it
      if (!links.some(l => l.url.toLowerCase() === trimmedUrl.toLowerCase())) {
        links.push({
          url: trimmedUrl,
          domain: domain,
          description: "Extracted via regex fallback"
        });
      }
    });
  }

  // Regex: Telegram Handles (e.g. @spammer_boss)
  const handleRegex = /@[a-zA-Z0-9_]{5,32}/g;
  const handleMatches = rawText.match(handleRegex);
  if (handleMatches) {
    handleMatches.forEach(match => handles.add(match.trim()));
  }

  // Regex: Indian Phone Numbers
  const phoneRegex = /(?:\+91[\-\s]?)?[6-9]\d{9}/g;
  const phoneMatches = rawText.match(phoneRegex);
  if (phoneMatches) {
    phoneMatches.forEach(match => {
      // Normalize: remove spacing and dash, enforce +91 prefix for consistency
      let clean = match.replace(/[\s\-]/g, '');
      if (!clean.startsWith('+91')) {
        if (clean.startsWith('91') && clean.length === 12) {
          clean = '+' + clean;
        } else {
          clean = '+91' + clean;
        }
      }
      phoneNumbers.add(clean);
    });
  }

  // 3. Normalization and Deduplication
  return {
    financialDetails: {
      upiIds: Array.from(upiIds).map(u => u.toLowerCase()),
      bankAccounts: bankAccounts.map(b => ({
        accountNumber: b.accountNumber,
        ifsc: b.ifsc.toUpperCase(),
        bankName: b.bankName
      })),
      cards: Array.from(cards)
    },
    links: links.map(l => ({
      url: l.url,
      domain: l.domain.toLowerCase(),
      description: l.description || "Shared by attacker"
    })),
    attackerIdentifiers: {
      phoneNumbers: Array.from(phoneNumbers),
      aliases: Array.from(aliases),
      handles: Array.from(handles)
    }
  };
};
