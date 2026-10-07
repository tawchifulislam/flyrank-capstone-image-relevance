import { env } from "../config/env.js";
import { embedText } from "../ai/embedClient.js";
import { insertCost } from "../data/costRepo.js";
import { insertPost } from "../data/postsRepo.js";
import { savePostVector } from "../data/vectorRepo.js";

export function postEmbeddingText({ title, body }) {
  return `${title}. ${body}`;
}

export async function createPost({ title, body }) {
  const post = await insertPost({ title, body });
  const { values, inputTokens } = await embedText(postEmbeddingText(post));
  await insertCost({
    callType: "embedding",
    model: env.EMBEDDING_MODEL,
    postId: post.id,
    inputTokens,
    outputTokens: 0,
    costUsd: (inputTokens / 1_000_000) * env.EMBEDDING_INPUT_USD_PER_M,
  });
  await savePostVector({ postId: post.id, embedding: values, model: env.EMBEDDING_MODEL });
  return post;
}
