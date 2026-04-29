import { scanConfig } from "../../config/scanConfig";
import { OllamaProvider } from "./ollamaProvider";
import { OpenAiProvider } from "./openAiProvider";
import type { AiTextProvider } from "./types";

export function getAiTextProvider(): AiTextProvider {
  if (scanConfig.aiProvider === "openai") {
    return new OpenAiProvider();
  }

  if (scanConfig.aiProvider === "ollama") {
    return new OllamaProvider();
  }

  throw new Error("AI provider is set to rules; no AI text provider is configured.");
}

export function getProviderMaxCharsPerChunk(): number {
  if (scanConfig.aiProvider === "openai") {
    return scanConfig.openai.maxCharsPerChunk;
  }

  return scanConfig.ollama.maxCharsPerChunk;
}
