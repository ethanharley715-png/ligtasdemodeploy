import { scanConfig } from "../../config/scanConfig";
import type { AiTextProvider } from "./types";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export class OllamaProvider implements AiTextProvider {
  readonly name = "ollama" as const;

  async generate(prompt: string): Promise<string> {
    const url = new URL("/api/generate", scanConfig.ollama.baseUrl).toString();

    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: scanConfig.ollama.model,
          prompt,
          stream: false,
          options: {
            temperature: 0,
            top_p: 1,
            top_k: 1,
            repeat_penalty: 1,
          },
        }),
      },
      scanConfig.ollama.timeoutMs,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${text}`);
    }

    const json = await response.json() as { response?: unknown };
    if (typeof json.response !== "string") {
      throw new Error("Ollama API response did not include generated text.");
    }

    return json.response;
  }
}

export async function callOllama(prompt: string): Promise<string> {
  return new OllamaProvider().generate(prompt);
}
