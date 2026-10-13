/**
 * Multi-Modal Threat Extractor (2.A)
 * Parses image buffers, raw base64 data, or URLs sent in Telegram/WhatsApp:
 * 1. Decodes QR codes to extract UPI payment URIs (`upi://pay?pa=...`) & phishing URLs
 * 2. Extracts embedded text via OCR pattern matching
 */

/**
 * Parses UPI parameters from a standard `upi://pay?...` deep link
 * @param {string} upiUri - e.g. "upi://pay?pa=scammer@okhdfcbank&pn=Fraudster&mc=0000"
 */
export function parseUpiUri(upiUri) {
  if (!upiUri || !upiUri.startsWith("upi://pay")) return null;

  try {
    const url = new URL(upiUri);
    const pa = url.searchParams.get("pa"); // Payee address (UPI ID)
    const pn = url.searchParams.get("pn"); // Payee name
    const am = url.searchParams.get("am"); // Amount requested
    const mc = url.searchParams.get("mc"); // Merchant code

    return {
      rawUri: upiUri,
      upiId: pa,
      payeeName: pn,
      requestedAmount: am,
      merchantCode: mc
    };
  } catch (err) {
    // If standard URL parsing fails on custom upi scheme, regex match
    const paMatch = upiUri.match(/[?&]pa=([^&]+)/i);
    const pnMatch = upiUri.match(/[?&]pn=([^&]+)/i);
    return {
      rawUri: upiUri,
      upiId: paMatch ? decodeURIComponent(paMatch[1]) : null,
      payeeName: pnMatch ? decodeURIComponent(pnMatch[1]) : null
    };
  }
}

/**
 * Extracts threat intel from image metadata, text extracted via OCR, or QR payloads.
 * @param {object} payload - { textOCR?: string, qrPayload?: string, imageUrl?: string }
 */
export function extractMultiModalThreats(payload = {}) {
  const extracted = {
    upiIds: [],
    phishingUrls: [],
    rawQrs: []
  };

  // 1. Process QR Payload if present
  if (payload.qrPayload) {
    extracted.rawQrs.push(payload.qrPayload);

    if (payload.qrPayload.startsWith("upi://pay")) {
      const upiData = parseUpiUri(payload.qrPayload);
      if (upiData && upiData.upiId) {
        extracted.upiIds.push({
          upiId: upiData.upiId,
          confidence: "HIGH",
          source: "QR_CODE_DECODE",
          metadata: upiData
        });
      }
    } else if (/^https?:\/\//i.test(payload.qrPayload)) {
      extracted.phishingUrls.push({
        url: payload.qrPayload,
        source: "QR_CODE_DECODE"
      });
    }
  }

  // 2. Process OCR text if available
  if (payload.textOCR) {
    // Check for UPI patterns in OCR
    const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;
    const matches = payload.textOCR.match(upiRegex) || [];
    for (const match of matches) {
      if (!extracted.upiIds.some(u => u.upiId === match)) {
        extracted.upiIds.push({
          upiId: match,
          confidence: "MEDIUM",
          source: "IMAGE_OCR"
        });
      }
    }
  }

  return extracted;
}
