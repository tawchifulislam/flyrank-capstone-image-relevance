import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { visionSchema } from "./visionSchema.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const PROMPT = `Look at this image and describe its main subject.
Return only a JSON object with exactly these fields:
- subject: the specific main subject, for example "red fox"
- category: one broad word, for example "animal", "vehicle", "food", "landscape", "person", "object"
- species: for animals, the single common name of the animal such as "fox", "wolf", "dog", "deer", "bear"; for anything else use "none"
- attributes: an array of 1 to 8 short visual descriptors
- caption: one plain sentence describing the image
- confidence: a number from 0 to 1 for how sure you are about the subject and species, lower it when the image is blurry, distant, partly hidden or ambiguous`;

export async function describeImage({ base64, mimeType }) {
  const response = await ai.models.generateContent({
    model: env.VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data: base64 } }, { text: PROMPT }],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const usage = {
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
  };

  let raw;
  try {
    raw = JSON.parse(response.text);
  } catch {
    return { ok: false, error: "model returned non-JSON output", usage };
  }

  const parsed = visionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), usage };
  }
  return { ok: true, data: parsed.data, usage };
}
