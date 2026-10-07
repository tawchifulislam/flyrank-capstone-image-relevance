import { env } from "../config/env.js";
import { embedText } from "../ai/embedClient.js";
import { insertCost } from "../data/costRepo.js";
import { listSpecies } from "../data/speciesRepo.js";
import { cosine } from "./similarity.js";

let cache = null;

async function loadLabelVectors() {
  const species = await listSpecies();
  const key = species.map((s) => s.species).join("|");
  if (cache && cache.key === key) return cache.items;

  const items = [];
  for (const s of species) {
    const { values, inputTokens } = await embedText(`A photo of a ${s.species}`);
    await insertCost({
      callType: "embedding",
      model: env.EMBEDDING_MODEL,
      inputTokens,
      outputTokens: 0,
      costUsd: (inputTokens / 1_000_000) * env.EMBEDDING_INPUT_USD_PER_M,
    });
    items.push({ species: s.species, category: s.category, vector: values });
  }
  cache = { key, items };
  return items;
}

export async function scoreSpecies(postVector) {
  const labels = await loadLabelVectors();
  return labels
    .map((l) => ({ species: l.species, category: l.category, score: cosine(postVector, l.vector) }))
    .sort((a, b) => b.score - a.score);
}

export async function detectSubject(postVector) {
  const scored = await scoreSpecies(postVector);
  const best = scored[0];
  const second = scored[1];
  const margin = second ? best.score - second.score : best.score;
  const confident = best.score >= env.SPECIES_MIN_SCORE;
  const speciesSet = confident
    ? scored.filter((s) => s.score >= best.score - env.SPECIES_AMBIGUITY_BAND && s.category === best.category).map((s) => s.species)
    : [];
  return {
    species: confident ? best.species : null,
    speciesSet,
    category: confident ? best.category : null,
    score: Number(best.score.toFixed(4)),
    margin: Number(margin.toFixed(4)),
    bestGuess: best.species,
  };
}
