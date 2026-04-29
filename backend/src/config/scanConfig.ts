function readBooleanEnv(key: string, fallback: boolean): boolean {
  const rawValue = process.env[key];

  if (rawValue == null || rawValue.trim() === "") {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readStringEnv(key: string, fallback: string): string {
  const rawValue = process.env[key];
  const trimmed = rawValue?.trim();

  return trimmed || fallback;
}

function readPositiveIntEnv(key: string, fallback: number): number {
  const rawValue = process.env[key];
  if (rawValue == null || rawValue.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type AiProviderName = "ollama" | "openai" | "rules";

function readAiProvider(): AiProviderName {
  const rawValue = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (rawValue === "openai" || rawValue === "rules" || rawValue === "ollama") {
    return rawValue;
  }

  return "ollama";
}

const aiProvider = readAiProvider();
const requestedAiEnabled = readBooleanEnv("AI_ENABLED", true);
const aiEnabled = requestedAiEnabled && aiProvider !== "rules";
const ruleScanEnabled = readBooleanEnv("RULE_FALLBACK_ENABLED", true);

if (!aiEnabled && !ruleScanEnabled) {
  throw new Error(
    "Invalid scan configuration: at least one of AI_ENABLED or RULE_FALLBACK_ENABLED must be enabled.",
  );
}

export const scanConfig = {
  aiProvider,
  aiEnabled,
  ruleScanEnabled,
  defaultScanMode: aiEnabled ? "ai" : "rules",
  ollama: {
    baseUrl: readStringEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    model: readStringEnv("OLLAMA_MODEL", "llama3:8b-instruct-q4_0"),
    timeoutMs: readPositiveIntEnv("OLLAMA_TIMEOUT_MS", 120000),
    maxCharsPerChunk: readPositiveIntEnv("OLLAMA_MAX_CHARS_PER_CHUNK", 3000),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim() || "",
    model: readStringEnv("OPENAI_MODEL", "gpt-4.1-mini"),
    timeoutMs: readPositiveIntEnv("OPENAI_TIMEOUT_MS", 120000),
    maxCharsPerChunk: readPositiveIntEnv("OPENAI_MAX_CHARS_PER_CHUNK", 12000),
  },
};
