import { ai } from "../config/ai.config";

export async function createEmbedding(text: string) {

 const response = await ai.embeddings.create({
  model: "text-embedding-3-small",
  input: text
 });

 return response.data[0].embedding;

}