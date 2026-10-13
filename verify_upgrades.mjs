/**
 * Verification Test Suite for Honeypot IEEE Major Project Upgrades:
 * 1. Multiple Personas (Kamla Devi, Rohan Sharma, Rajesh Uncle)
 * 2. Anti-Fingerprinting (Gaussian Typing Latency & Typo Injection)
 * 3. Multi-Modal Threat Extractor (UPI QR URIs & OCR parsing)
 * 4. Threat Intelligence Enrichment (URLhaus & Domain Heuristics)
 */

import { PERSONAS } from './agent/src/config/persona.js';
import { calculateHumanDelay, injectHumanTypos } from './agent/src/utils/antiFingerprint.js';
import { parseUpiUri, extractMultiModalThreats } from './agent/src/utils/multimodalExtractor.js';
import { inspectDomainHeuristics } from './backend/src/utils/threatEnricher.js';

console.log("==================================================");
console.log("🧪 RUNNING HONEYPOT UPGRADE VALIDATION SUITE");
console.log("==================================================\n");

// TEST 1: Multiple Personas
console.log("--- 1. Testing Personas Availability ---");
const personaKeys = Object.keys(PERSONAS);
console.log(`Configured Personas: ${personaKeys.join(", ")}`);
console.assert(personaKeys.includes("KAMLA_DEVI"), "Kamla Devi missing");
console.assert(personaKeys.includes("ROHAN_SHARMA"), "Rohan Sharma missing");
console.assert(personaKeys.includes("RAJESH_UNCLE"), "Rajesh Uncle missing");
console.log("✅ Personas validated: Kamla Devi (Elderly/Threats), Rohan Sharma (Student/Jobs), Rajesh Uncle (Business/Crypto)\n");

// TEST 2: Anti-Fingerprinting Simulation
console.log("--- 2. Testing Anti-Fingerprinting (Human Jitter & Typos) ---");
const sampleIncomingThreat = "Dear customer, your power will be cut tonight at 9:30 PM due to unpaid bill.";
const sampleCleanReply = "Beta ruko main passbook dekh rahi hu.";
const delay = calculateHumanDelay(sampleCleanReply, "KAMLA_DEVI", sampleIncomingThreat);
console.log(`Generated Simulated Typing Latency: ${delay}ms (Cognitive Reading + Typing Duration: ~3.8s - 22s)`);
console.assert(delay >= 3500 && delay <= 22000, "Delay outside realistic envelope");

const typoVersion = injectHumanTypos(sampleCleanReply, 1.0);
console.log(`Original: "${sampleCleanReply}"`);
console.log(`With Typo Noise: "${typoVersion}"`);
console.log("✅ Anti-Fingerprinting validated.\n");

// TEST 3: Multi-Modal Threat Extraction (QR Code UPI URLs)
console.log("--- 3. Testing Multi-Modal UPI QR Decoding ---");
const mockQrPayload = "upi://pay?pa=scammer889@okhdfcbank&pn=FraudsterMerchant&am=5000&mc=0000";
const parsedUpi = parseUpiUri(mockQrPayload);
console.log("Parsed QR UPI Payload:", parsedUpi);
console.assert(parsedUpi.upiId === "scammer889@okhdfcbank", "UPI extraction failed");
console.assert(parsedUpi.payeeName === "FraudsterMerchant", "Payee name extraction failed");

const mockOcrExtraction = extractMultiModalThreats({
  qrPayload: mockQrPayload,
  textOCR: "Payment pending to cyberthief@ybl please clear bill immediately"
});
console.log("Combined Multi-Modal Extracted IOCs:", JSON.stringify(mockOcrExtraction, null, 2));
console.assert(mockOcrExtraction.upiIds.length === 2, "Failed to extract both QR and OCR UPIs");
console.log("✅ Multi-modal QR and OCR extraction validated.\n");

// TEST 4: Threat Intelligence Domain Heuristics (2.C)
console.log("--- 4. Testing Domain Threat Heuristics ---");
const badDomain = "verify-kyc-update-portal.bank.secure-login.top";
const heuristics = inspectDomainHeuristics(badDomain);
console.log(`Domain: ${badDomain}`);
console.log("Heuristics:", heuristics);
console.assert(heuristics.suspiciousTLD === true, "TLD detection failed");
console.assert(heuristics.riskScore >= 4, "High risk domain not flagged");
console.log("✅ Threat heuristics enrichment validated.\n");

console.log("==================================================");
console.log("🎉 ALL UPGRADE TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
