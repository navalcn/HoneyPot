/**
 * Anti-Fingerprinting and Human Behavioral Simulation Utilities
 * 
 * 1. Simulates realistic human typing latency using Gaussian distribution
 *    Delay = Base_Reaction + (Chars * Typing_Speed_Per_Char) + Random_Jitter
 * 2. Injects natural phonetic typos and keyboard adjacency noise
 *    to defeat automated AI detection / LLM-fingerprinting scanners.
 */

// Common Hinglish / English phonetic typo patterns
const TYPO_REPLACEMENTS = [
  { match: /\bplease\b/gi, replacements: ["pls", "plz", "pleas"] },
  { match: /\bpayment\b/gi, replacements: ["paymnt", "paymet", "pymnt"] },
  { match: /\baccount\b/gi, replacements: ["accont", "accnt", "acount"] },
  { match: /\btransfer\b/gi, replacements: ["trnsfer", "transfr"] },
  { match: /\bbank\b/gi, replacements: ["banck", "bnk"] },
  { match: /\bmessage\b/gi, replacements: ["msg", "mesage"] },
  { match: /\bnumber\b/gi, replacements: ["numbr", "no.", "nmbr"] },
  { match: /\breceive\b/gi, replacements: ["recieve", "recive"] },
  { match: /\bhelp\b/gi, replacements: ["hlp", "hepl"] },
  { match: /\bminute\b/gi, replacements: ["mnt", "minut", "mints"] }
];

/**
 * Standard Box-Muller transform for generating normally distributed values
 */
function randomGaussian(mean = 0, stdev = 1) {
  const u1 = 1.0 - Math.random();
  const u2 = 1.0 - Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + stdev * randStdNormal;
}

/**
 * Computes realistic human delay (in milliseconds) before sending a reply
 * 
 * Accurately models real human conversation dynamics:
 * 1. Cognitive / Deliberation Delay (T_think):
 *    - Reading the scammer's message and comprehension (based on incoming message complexity).
 *    - Hesitating, searching for glasses, checking account/app, or verifying suspicious claims.
 * 2. Physical Mobile Typing Delay (T_type):
 *    - Strictly proportional to the generated reply text length (character count L).
 *    - Models smartphone keystroke speed (WPM / ms-per-keystroke + pauses between words).
 * 3. Total Latency = T_think + T_type + Stochastic Jitter
 * 
 * @param {string} replyText - The honeypot's outgoing response text
 * @param {string} personaId - KAMLA_DEVI (slower/confused) vs ROHAN_SHARMA (fast thumbs) vs RAJESH_UNCLE (cautious)
 * @param {string} incomingText - Optional latest message received from scammer to compute reading time
 */
export function calculateHumanDelay(replyText = "", personaId = "KAMLA_DEVI", incomingText = "") {
  if (!replyText) return 0;

  // 1. STAGE 1: COGNITIVE DELIBERATION & VERIFICATION DELAY (T_think)
  // Humans first read the incoming threat/offer, get anxious/curious, or hesitate before touching the keyboard.
  const incomingLength = (incomingText && typeof incomingText === "string") ? incomingText.length : 60;
  
  // Reading speed: Average adult reads ~200-250 WPM (approx 20-30ms per character)
  let readingTime = incomingLength * randomGaussian(22, 5);

  let verificationHesitation;
  let charKeystrokeSpeed;

  if (personaId === "KAMLA_DEVI") {
    // Elderly persona: finds reading spectacles, panics, checks passbook or re-reads 2-3 times
    verificationHesitation = Math.max(3000, randomGaussian(4500, 1200));
    // Clumsy single-finger typing on mobile keyboard: ~120-170ms per character
    charKeystrokeSpeed = Math.max(100, randomGaussian(140, 25));
  } else if (personaId === "ROHAN_SHARMA") {
    // College student: reads fast, quick decision, fast dual-thumb smartphone typing
    verificationHesitation = Math.max(1200, randomGaussian(2000, 500));
    // Fast mobile typing: ~45-75ms per character
    charKeystrokeSpeed = Math.max(40, randomGaussian(60, 12));
  } else {
    // Rajesh Uncle: reads carefully, calculates margins, cautious business texting
    verificationHesitation = Math.max(2200, randomGaussian(3500, 900));
    // Moderate index-finger typing: ~80-120ms per character
    charKeystrokeSpeed = Math.max(70, randomGaussian(95, 18));
  }

  const cognitiveDelay = readingTime + verificationHesitation;

  // 2. STAGE 2: PHYSICAL TYPING DELAY (T_type)
  // Strictly proportional to reply character count, including spacebar/backspace pauses
  const wordCount = replyText.trim().split(/\s+/).length;
  // Natural pause between words (~150-300ms pause when hitting spacebar and thinking of next word)
  const wordPauses = wordCount * randomGaussian(180, 40);
  const typingDuration = (replyText.length * charKeystrokeSpeed) + wordPauses;

  // 3. STAGE 3: STOCHASTIC JITTER & APP SWITCHING
  // Occasional 2-3 second pause (simulating opening PhonePe, looking at SMS OTP)
  const appInteractionPause = Math.random() < 0.40 ? randomGaussian(2800, 700) : 0;

  const totalCalculated = Math.round(cognitiveDelay + typingDuration + appInteractionPause);

  // Bounds: minimum 3,800ms up to 22,000ms for long elderly stalling replies
  return Math.min(Math.max(totalCalculated, 3800), 22000);
}

/**
 * Injects subtle realistic human typos into reply text with probability p
 * @param {string} text - Clean reply from LLM
 * @param {number} probability - Chance of introducing a typo (default 0.18 = 18%)
 */
export function injectHumanTypos(text = "", probability = 0.18) {
  if (!text || typeof text !== "string") return text;
  
  let modified = text;

  // 1. Try phonetic replacements first
  for (const rule of TYPO_REPLACEMENTS) {
    if (Math.random() < probability && rule.match.test(modified)) {
      const choice = rule.replacements[Math.floor(Math.random() * rule.replacements.length)];
      modified = modified.replace(rule.match, choice);
      break; // Only apply one replacement per sentence to keep readability high
    }
  }

  // 2. Occasionally drop an apostrophe (e.g. don't -> dont)
  if (Math.random() < 0.25) {
    modified = modified.replace(/([a-zA-Z])'([a-zA-Z])/g, "$1$2");
  }

  return modified;
}
