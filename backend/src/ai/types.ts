// List of all allowed issue types as constant string literals
export const ALLOWED_TYPES = [
  "TEMPLATE_ARTIFACT",
  "UNREMOVED_GUIDANCE",
  "MISSING_INFORMATION",
  "CONTRADICTION",
  "LIMITATION_CONTRADICTION",
  "INCOMPLETE_LIMITATIONS"
] as const;
// "as const" ensures each value is treated as a literal type (not just string)

// Creates a union type from the ALLOWED_TYPES array
// Result: "TEMPLATE_ARTIFACT" | "UNREMOVED_GUIDANCE" | ...
export type IssueType = typeof ALLOWED_TYPES[number];

// Defines the structure of a single issue
export type Issue = {
  type: IssueType;      // must be one of the allowed types above
  description: string;  // human-readable explanation of the issue
  section: string;      // identifies which section the issue belongs to
  quote?: string;       // optional: exact text snippet related to the issue
  suggestedAction?: string;
  severity?: string;
  pageNumber?: number | null;
  confidence?: number;
};

// Defines the expected structure of the AI response
export type AIResponse = {
  issues: Issue[]; // array of detected issues
};
