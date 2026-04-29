type RedactionRule = {
  pattern: RegExp;
  replacement: string;
};

const REDACTION_RULES: RedactionRule[] = [
  // 1. Email addresses
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },

  // 2. Reference / invoice / policy / UPRN numbers (before phone to avoid UPRN digits matching phone)
  { pattern: /\bUPRN[\s:]*\d{5,12}\b/gi, replacement: "[REFERENCE]" },
  { pattern: /(?<!\[)\b(?:REF|INV|POL|POLICY|CLAIM|CASE|FRA)[\s\-:#]?\w[\w\-]{2,}\b/gi, replacement: "[REFERENCE]" },
  { pattern: /\b(?:Reference|Ref|Invoice|Policy|Claim)\s*(?:No\.?|Number|#|:)\s*\w[\w\-]{2,}\b/gi, replacement: "[REFERENCE]" },

  // 3. UK phone numbers (mobile, landline, +44 international)
  { pattern: /(?:\+44\s?|0)(?:\d[\s\-]?){9,10}\d/g, replacement: "[PHONE]" },
  // International with + prefix (fallback)
  { pattern: /\+\d[\d\s\-()]{7,}\d/g, replacement: "[PHONE]" },

  // 4. UK postcodes (e.g. SW1A 1AA, M1 1AA, EC2R 8AH)
  { pattern: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, replacement: "[POSTCODE]" },

  // 5. Person names — honorific-based (Mr John Smith, Dr. Alice Brown)
  { pattern: /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Dame)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g, replacement: "[NAME]" },

  // 6. Person names — label-based (Assessed by: Jane Doe, Client: Robert Johnson)
  // Requires colon or colon+space after the label to avoid false positives
  {
    pattern: /\b(?:Assessed by|Prepared (?:by|for)|Client|Assessor|Surveyor|Inspector|Responsible Person|Contact|Occupier|Tenant|Landlord|Managing Agent)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/gi,
    replacement: "[NAME]",
  },

  // 7. Company names (words followed by corporate suffixes, supports & in names)
  { pattern: /\b(?:[A-Z][A-Za-z'\-]+(?:(?:\s+|\s*&\s*)[A-Z][A-Za-z'\-]+)*)\s+(?:Ltd|Limited|PLC|Inc|LLP|Corp|Corporation|Group|Holdings|Associates|Partners|Services)\b\.?/g, replacement: "[COMPANY]" },

  // 8. Street addresses — Flat/Unit patterns (Flat 4, 23 High Street)
  {
    pattern: /\b(?:Flat|Unit|Apartment|Suite)\s+\d+[A-Za-z]?\s*,?\s*\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Cl|Crescent|Cres|Court|Ct|Place|Pl|Way|Terrace|Gardens|Gdns|Grove|Park|Square|Row|Mews|Walk|Rise|Hill|Gate|Green|Circus|Parade|Wharf|Quay)\b/gi,
    replacement: "[ADDRESS]",
  },
  // House number + street name (123 Victoria Road)
  {
    pattern: /\b\d+[A-Za-z]?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Close|Cl|Crescent|Cres|Court|Ct|Place|Pl|Way|Terrace|Gardens|Gdns|Grove|Park|Square|Row|Mews|Walk|Rise|Hill|Gate|Green|Circus|Parade|Wharf|Quay)\b/gi,
    replacement: "[ADDRESS]",
  },
  // Named buildings (Oakwood House, Riverside Tower)
  {
    pattern: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:House|Tower|Building|Mansion|Lodge|Hall|Centre|Center|Estate)\b/g,
    replacement: "[ADDRESS]",
  },
];

export function anonymizeText(text: string): string {
  let result = text;
  for (const rule of REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}
