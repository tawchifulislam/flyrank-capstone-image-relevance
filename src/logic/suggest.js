import { env } from "../config/env.js";
import { detectSubject } from "./detectPostSubject.js";
import { rankCandidates, cosine } from "./similarity.js";
import { evaluateCandidate } from "./guard.js";
import { getPost, getPostVector, listImageCandidates, updatePostSubject } from "../data/postsRepo.js";
import { saveSuggestions, getCandidateById } from "../data/suggestionsRepo.js";

const thresholds = () => ({
  minImageConfidence: env.MIN_IMAGE_CONFIDENCE,
  minSimilarity: env.MIN_SIMILARITY,
});

async function loadPost(postId) {
  const post = await getPost(postId);
  if (!post) return { error: "post_not_found" };
  const vector = await getPostVector(postId);
  if (!vector) return { error: "post_not_embedded" };
  const detected = await detectSubject(vector);
  await updatePostSubject(postId, {
    subject: detected.species,
    category: detected.category,
    species: detected.species,
  });
  return { post, vector, detected };
}

export async function suggestForPost(postId) {
  const loaded = await loadPost(postId);
  if (loaded.error) return loaded;
  const { vector, detected } = loaded;

  const ranked = rankCandidates(vector, await listImageCandidates()).slice(0, 5);
  const evaluated = ranked.map((c, i) => {
    const verdict = evaluateCandidate({
      post: { species: detected.species, category: detected.category },
      candidate: c,
      thresholds: thresholds(),
    });
    return { rank: i + 1, candidate: c, verdict };
  });

  await saveSuggestions(
    postId,
    evaluated.map((e) => ({
      imageId: e.candidate.image_id,
      rank: e.rank,
      score: e.candidate.score,
      guardResult: e.verdict.passed ? "passed" : "rejected",
      reason: e.verdict.passed ? null : e.verdict.reasons.join("; "),
    }))
  );

  const view = (e) => ({
    rank: e.rank,
    imageId: e.candidate.image_id,
    filePath: e.candidate.file_path,
    score: Number(e.candidate.score.toFixed(4)),
    subject: e.candidate.subject,
    species: e.candidate.species,
    guard: e.verdict.passed ? "passed" : "rejected",
    reasons: e.verdict.reasons,
  });

  const winner = evaluated.find((e) => e.verdict.passed);
  return {
    postId,
    detected: { species: detected.species, score: detected.score, margin: detected.margin, bestGuess: detected.bestGuess },
    suggestion: winner ? view(winner) : null,
    message: winner ? "suggestion found" : "no confident match",
    reasons: winner ? [] : evaluated[0]?.verdict.reasons ?? ["no candidates available"],
    candidates: evaluated.map(view),
  };
}

export async function checkForcedImage(postId, imageId) {
  const loaded = await loadPost(postId);
  if (loaded.error) return loaded;
  const candidate = await getCandidateById(imageId);
  if (!candidate) return { error: "image_not_found" };

  const score = cosine(loaded.vector, candidate.embedding);
  const verdict = evaluateCandidate({
    post: { species: loaded.detected.species, category: loaded.detected.category },
    candidate: { ...candidate, score },
    thresholds: thresholds(),
  });

  return {
    postId,
    imageId,
    postSpecies: loaded.detected.species,
    imageSpecies: candidate.species,
    score: Number(score.toFixed(4)),
    result: verdict.passed ? "passed" : "rejected",
    reasons: verdict.reasons,
  };
}
