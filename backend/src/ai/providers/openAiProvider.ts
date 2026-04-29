import OpenAI from "openai";
import { scanConfig } from "../../config/scanConfig";
import type { AiTextProvider } from "./types";

const SYSTEM_PROMPT = `
You are a pre-QC support tool for Ligtas QC.
Flag likely non-technical quality-control issues for human review.
Do not make final legal, regulatory, fire-safety, compliance, or professional judgements.
Do not invent issues. Every issue must be grounded in the supplied report text.
Return only strict JSON using the requested schema.
`.trim();

export class OpenAiProvider implements AiTextProvider {
  readonly name = "openai" as const;

  private client(): OpenAI {
    if (!scanConfig.openai.apiKey) {
      throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
    }

    return new OpenAI({
      apiKey: scanConfig.openai.apiKey,
      timeout: scanConfig.openai.timeoutMs,
    });
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.client().chat.completions.create(
      {
        model: scanConfig.openai.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      },
      {
        timeout: scanConfig.openai.timeoutMs,
      },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response is empty.");
    }

    return content;
  }
}
