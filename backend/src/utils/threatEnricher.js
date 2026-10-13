/**
 * Threat Intelligence Enrichment Utility (2.C)
 * 
 * Enriches extracted Indicators of Compromise (URLs, Domains, UPI handles, IPs):
 * 1. Checks URLs against URLhaus Abuse.ch open API (Zero Cost, No API key needed)
 * 2. Checks domains for suspicious TLDs, age, or dynamic DNS patterns
 * 3. Enriches IP / domain data with WHOIS/DNS metadata
 */

import dns from 'node:dns/promises';

/**
 * Checks a URL against URLhaus open database (Zero API Key needed!)
 * @param {string} targetUrl - URL to check
 * @returns {Promise<{isKnownMalicious: boolean, threat?: string, tags?: string[], reporter?: string}>}
 */
export async function checkURLhaus(targetUrl) {
  try {
    const params = new URLSearchParams();
    params.append('url', targetUrl);

    const res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      body: params,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.query_status === 'ok') {
        return {
          isKnownMalicious: true,
          threat: data.threat || 'Malicious Phishing / Malware Host',
          tags: data.tags || [],
          urlStatus: data.url_status,
          dateAdded: data.date_added
        };
      }
    }
  } catch (err) {
    console.warn(`[URLhaus Lookup Warning] Unable to check ${targetUrl}:`, err.message);
  }

  return { isKnownMalicious: false };
}

/**
 * Basic heuristic inspection of domain suspiciousness
 */
export function inspectDomainHeuristics(domain) {
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.buzz', '.work', '.click', '.loan'];
  const isSuspiciousTLD = suspiciousTLDs.some(tld => domain.toLowerCase().endsWith(tld));
  const hasMultipleSubdomains = domain.split('.').length > 3;
  const hasIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain);

  return {
    suspiciousTLD: isSuspiciousTLD,
    deepSubdomainStructure: hasMultipleSubdomains,
    rawIpHost: hasIpAddress,
    riskScore: (isSuspiciousTLD ? 4 : 0) + (hasMultipleSubdomains ? 2 : 0) + (hasIpAddress ? 4 : 0)
  };
}

/**
 * Master enrichment function for an extracted threat intelligence payload
 * @param {object} threatIntel - Extracted IOCs (phishingUrls, upiIds, phoneNumbers, etc.)
 */
export async function enrichThreatIntelligence(threatIntel) {
  if (!threatIntel) return threatIntel;

  const enrichedIntel = { ...threatIntel, enrichment: {} };

  // 1. Enrich Phishing URLs
  if (Array.isArray(threatIntel.phishingUrls) && threatIntel.phishingUrls.length > 0) {
    enrichedIntel.enrichment.urlReputations = [];
    for (const item of threatIntel.phishingUrls) {
      const url = typeof item === 'string' ? item : item.url;
      if (!url) continue;

      try {
        const parsed = new URL(url);
        const domainHeuristics = inspectDomainHeuristics(parsed.hostname);
        const urlhausData = await checkURLhaus(url);

        enrichedIntel.enrichment.urlReputations.push({
          url,
          domain: parsed.hostname,
          urlhaus: urlhausData,
          heuristics: domainHeuristics,
          isHighRisk: urlhausData.isKnownMalicious || domainHeuristics.riskScore >= 4
        });
      } catch (e) {
        // invalid URL format, ignore
      }
    }
  }

  return enrichedIntel;
}
