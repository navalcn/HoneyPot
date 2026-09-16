// Direct extraction caller using Groq (super fast JSON mode)
async function callExtractor(messages) {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPEN_ROUTER_API_KEY;

  if (groqKey) {
    const modelToUse = process.env.GROQ_EXTRACT_MODEL || "openai/gpt-oss-20b";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelToUse,
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message?.content || "{}";
      }
    }
  }

  if (openRouterKey) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct",
        messages,
        temperature: 0.1
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "{}";
    }
  }

  throw new Error("No valid LLM API key found for extraction.");
}


/**
 * Extracts financial details (UPI IDs, Bank accounts, cards) via LLM
 */
async function extractFinancialDetails(transcript) {
  try {
    const raw = await callExtractor([
      {
        role: "system",
        content: `You are a cybersecurity threat analyst. Analyze the conversation transcript and extract financial identifiers: UPI IDs, bank accounts (accountNumber, ifsc, bankName), and credit/debit card numbers.
Respond ONLY with a valid raw JSON object matching this structure:
{"upiIds": ["string"], "bankAccounts": [{"accountNumber": "string", "ifsc": "string", "bankName": "string"}], "cards": ["string"]}
Do not add markdown code blocks.`
      },
      {
        role: "user",
        content: `Conversation Transcript:\n${transcript}`
      }
    ]);

    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        upiIds: Array.isArray(parsed.upiIds) ? parsed.upiIds : [],
        bankAccounts: Array.isArray(parsed.bankAccounts) ? parsed.bankAccounts : [],
        cards: Array.isArray(parsed.cards) ? parsed.cards : []
      };
    }
    return { upiIds: [], bankAccounts: [], cards: [] };
  } catch (error) {
    console.error("Error extracting financial details:", error.message);
    return { upiIds: [], bankAccounts: [], cards: [] };
  }
}

/**
 * Extracts URLs/Links via LLM
 */
async function extractLinks(transcript) {
  try {
    const raw = await callExtractor([
      {
        role: "system",
        content: `You are a cybersecurity threat analyst. Analyze the conversation transcript and extract phishing URLs, links, or scam domains.
Respond ONLY with a valid raw JSON object:
{"links": [{"url": "string", "domain": "string", "description": "string"}]}
Do not add markdown code blocks.`
      },
      {
        role: "user",
        content: `Conversation Transcript:\n${transcript}`
      }
    ]);

    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        links: Array.isArray(parsed.links) ? parsed.links : []
      };
    }
    return { links: [] };
  } catch (error) {
    console.error("Error extracting links:", error.message);
    return { links: [] };
  }
}

/**
 * Extracts phone numbers/aliases/handles via LLM
 */
async function extractAttackerIdentifiers(transcript) {
  try {
    const raw = await callExtractor([
      {
        role: "system",
        content: `You are a cybersecurity threat analyst. Analyze the transcript and extract attacker identifiers: phone numbers, aliases/names, and social media handles (starting with @).
Respond ONLY with a valid raw JSON object:
{"phoneNumbers": ["string"], "aliases": ["string"], "handles": ["string"]}
Do not add markdown code blocks.`
      },
      {
        role: "user",
        content: `Conversation Transcript:\n${transcript}`
      }
    ]);


    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        phoneNumbers: Array.isArray(parsed.phoneNumbers) ? parsed.phoneNumbers : [],
        aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
        handles: Array.isArray(parsed.handles) ? parsed.handles : []
      };
    }
    return { phoneNumbers: [], aliases: [], handles: [] };
  } catch (error) {
    console.error("Error extracting attacker identifiers:", error.message);
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
  // upiIds from LLM are plain strings — we classify them below
  const llmUpiStrings = (financials.upiIds || []).map(s => s.toLowerCase().trim());
  const bankAccounts = financials.bankAccounts || [];
  const cards = new Set(financials.cards || []);
  const links = linkData.links || [];
  const phoneNumbers = new Set(identifiers.phoneNumbers || []);
  const aliases = new Set(identifiers.aliases || []);
  const handles = new Set(identifiers.handles || []);

  // 2. Two-tier UPI regex (Issue 2 fix)
  const rawText = turns.map(t => t.text).join(' ');

  // Tier-1: known Indian UPI VPA suffixes — high confidence, not emails/URLs
  const HIGH_CONF_UPI_RE = /[a-zA-Z0-9.\-_]{2,256}@(okaxis|oksbi|okhdfcbank|okicici|ybl|paytm|upi|axl|ibl|apl|hdfcbank|icici)(?=[\s,"'`]|$)/gi;
  // Tier-2: original loose pattern — catches anything@word, flagged low confidence
  const LOW_CONF_UPI_RE  = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;

  // Map keyed by normalised id; tier-1 wins over tier-2 for the same id
  const upiMap = new Map();

  // Seed with LLM results — classify by tier-1 test
  llmUpiStrings.forEach(id => {
    const confidence = HIGH_CONF_UPI_RE.test(id) ? 'high' : 'low';
    HIGH_CONF_UPI_RE.lastIndex = 0; // reset stateful regex after .test()
    upiMap.set(id, { id, confidence });
  });

  // Apply tier-1 regex against raw text
  const tier1Matches = rawText.match(HIGH_CONF_UPI_RE) || [];
  tier1Matches.forEach(match => {
    const id = match.trim().toLowerCase();
    upiMap.set(id, { id, confidence: 'high' });
  });

  // Apply tier-2 regex — only add entries not already captured at high confidence
  const tier2Matches = rawText.match(LOW_CONF_UPI_RE) || [];
  tier2Matches.forEach(match => {
    const id = match.trim().toLowerCase();
    if (!upiMap.has(id)) {
      upiMap.set(id, { id, confidence: 'low' });
    }
  });

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
      // Each entry: { id: string, confidence: 'high' | 'low' }
      upiIds: Array.from(upiMap.values()),
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
