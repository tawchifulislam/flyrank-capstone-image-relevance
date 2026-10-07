import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function embedText(text) {
  const response = await ai.models.embedContent({
    model: env.EMBEDDING_MODEL,
    contents: text,
    config: { taskType: "SEMANTIC_SIMILARITY" },
  });
  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("embedding response had no values");
  }
  return { values, inputTokens: Math.ceil(text.length / 4) };
}
