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
 * Mobile texting involves reading, hesitating/thinking, unlocking, and typing.
 * Range: 3,500ms (fast student text) to 18,000ms (clumsy elderly/panicked typing)
 * @param {string} text - Message text
 * @param {string} personaId - KAMLA_DEVI (slower) vs ROHAN_SHARMA (faster) vs RAJESH_UNCLE
 */
export function calculateHumanDelay(text = "", personaId = "KAMLA_DEVI") {
  if (!text) return 0;
  
  // Persona-specific reading & hesitation time (in ms)
  let baseReaction;
  let charSpeed;
  
  if (personaId === "KAMLA_DEVI") {
    // Elderly person: finds spectacles, reads slowly, re-reads threat (4 to 9 sec base)
    baseReaction = Math.max(3500, randomGaussian(6000, 1500));
    charSpeed = randomGaussian(95, 25); // slow single-finger typing
  } else if (personaId === "ROHAN_SHARMA") {
    // College student: fast typer, but checks notifications (2.5 to 6 sec base)
    baseReaction = Math.max(2500, randomGaussian(3800, 900));
    charSpeed = randomGaussian(45, 12); // fast thumbs typing
  } else {
    // Rajesh Uncle: business owner, cautious (3.5 to 8 sec base)
    baseReaction = Math.max(3000, randomGaussian(5200, 1200));
    charSpeed = randomGaussian(75, 18);
  }
  
  // Random human hesitation burst (e.g. app switching, network lag)
  const occasionalHesitation = Math.random() < 0.35 ? randomGaussian(2500, 800) : 0;
  
  const typingDuration = text.length * Math.max(30, charSpeed);
  const totalDelay = Math.round(baseReaction + typingDuration + occasionalHesitation);

  // Return realistic delay clamped between 3,500ms and 18,000ms
  return Math.min(Math.max(totalDelay, 3500), 18000);
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
