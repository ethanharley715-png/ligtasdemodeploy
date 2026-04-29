


export interface ReportInput {
    id: string;
    observations: string;
    findings: string;
    limitations: string;
    conclusion: string;
    full: string;
}
export function buildPrompt(report: ReportInput) {

    const allowedTypes = `
Allowed issue types (use EXACTLY these values):
- TEMPLATE_ARTIFACT
- UNREMOVED_GUIDANCE
- MISSING_INFORMATION
- CONTRADICTION
- LIMITATION_CONTRADICTION
- INCOMPLETE_LIMITATIONS
`;

    return `
You are a meticulous Quality Control AI.

Analyze the report below and identify ALL quality issues in THIS chunk. Be aggressive—report anything that seems wrong, missing, contradictory, or incomplete. Do NOT combine multiple issues into one. 

Rules:

1. Only use the allowed types above. Do NOT invent types.
2. Section field: use structured identifiers (e.g., "Section 9.1") if present; otherwise, use a short quote (5–12 words) from the text.
3. Confidence: provide a 0–1 score for EACH issue.
4. Chunked content: do NOT assume this is the full report. Ignore references to future sections.
5. Missing info: only flag content clearly missing in this chunk.
6. Do NOT flag anonymized names or signatures as missing.

Report to analyze:

${allowedTypes}

Report:
${report.full}

Return STRICT JSON only:

{
  "issues": [
    {
      "type": "<allowed type>",
      "description": "<clear description of the issue>",
      "section": "<section number or short quote>",
      "confidence": 0.0
    }
  ]
}
`;
}

/* ${examples?.map((e: { type: string; description: string }) => `
Example Issue:
Type: ${e.type}
Description: ${e.description}
`).join("\n")} */

/*
8. Anonymization:
- Some reports may be anonymized.
- DO NOT report missing names, signatures, or contact details as issues.
*/