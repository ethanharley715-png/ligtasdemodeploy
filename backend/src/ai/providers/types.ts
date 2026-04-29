export interface AiTextProvider {
  readonly name: "ollama" | "openai";
  generate(prompt: string): Promise<string>;
}
