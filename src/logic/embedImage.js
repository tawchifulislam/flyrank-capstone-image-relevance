import { env } from "../config/env.js";
import { embedText } from "../ai/embedClient.js";
import { insertCost } from "../data/costRepo.js";
import { saveImageVector } from "../data/vectorRepo.js";

export function imageEmbeddingText(meta) {
  return `${meta.subject}. ${meta.caption} Species: ${meta.species}. ${meta.attributes.join(", ")}.`;
}

export async function embedImage(meta) {
  const text = imageEmbeddingText(meta);
  const { values, inputTokens } = await embedText(text);
  await insertCost({
    callType: "embedding",
    model: env.EMBEDDING_MODEL,
    imageId: meta.image_id,
    inputTokens,
    outputTokens: 0,
    costUsd: (inputTokens / 1_000_000) * env.EMBEDDING_INPUT_USD_PER_M,
  });
  await saveImageVector({ imageId: meta.image_id, embedding: values, model: env.EMBEDDING_MODEL });
  return values.length;
}
