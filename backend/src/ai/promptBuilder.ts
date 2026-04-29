export function buildPrompt(title: string, content: string): string {
  const safeTitle = JSON.stringify(title);
  const safeContent = JSON.stringify(content);

  return `
You are analysing extracted report text for Ligtas QC.

Purpose:
- This is a pre-QC support tool.
- Flag likely non-technical QC issues for human review.
- Do not make final legal, regulatory, fire-safety, compliance, or professional judgements.
- Do not invent issues not grounded in the report text.

Allowed issue types:
- TEMPLATE_ARTIFACT
- UNREMOVED_GUIDANCE
- MISSING_INFORMATION
- CONTRADICTION
- LIMITATION_CONTRADICTION
- INCOMPLETE_LIMITATIONS

Detection guidance:
- TEMPLATE_ARTIFACT: visible placeholders such as XX, XXX, XXXXX, bracketed placeholders, draft/template artefacts, or incomplete template tokens.
- UNREMOVED_GUIDANCE: visible author instructions or template guidance left in the report.
- MISSING_INFORMATION: explicit blanks, missing required text, or fields visibly left incomplete.
- CONTRADICTION: two report statements that visibly conflict.
- LIMITATION_CONTRADICTION: limitation wording that visibly conflicts with findings, recommendations, or conclusion text.
- INCOMPLETE_LIMITATIONS: limitation sections that are visibly incomplete, dangling, or internally unfinished.

Rules:
- Report only issues visible in the supplied text.
- Keep each occurrence as a separate issue.
- Include a short exact evidence snippet wherever possible.
- Use the nearest section heading or section number visible in the text.
- If unsure, omit the issue rather than guessing.

PDF extraction/layout artefacts to ignore:
- Extracted text may split superscript ordinals or styled text across lines, for example "8\\nth\\nJuly 2022" or "8 th July 2022". Treat these as normal dates, not template artefacts.
- Do not flag normal dates, addresses, headings, page labels, or formatting-only line breaks as QC issues.
- Do not report an issue merely because the extracted text has awkward spacing, missing spaces, soft line breaks, or a word split across adjacent lines.
- Only flag TEMPLATE_ARTIFACT when the evidence is a real visible placeholder/template residue such as "XX", "XXX", "XXXXX", "[insert text]", "[TBC]", "delete as applicable", or author guidance left in the report.
- If the issue description would mention "formatting", "split awkwardly", "line break", or "extraction", omit it.

Return only valid JSON in this exact shape:
{
  "issues": [
    {
      "type": "TEMPLATE_ARTIFACT",
      "severity": "low",
      "description": "Short human-readable description.",
      "suggestedAction": "Short suggested fix for the reviewer.",
      "quote": "Short exact evidence snippet from the report text.",
      "pageNumber": null,
      "section": "Nearest section heading or number",
      "confidence": 0.8
    }
  ]
}

If no issues are found, return:
{ "issues": [] }

Title: ${safeTitle}

Report text:
${safeContent}
`.trim();
}
