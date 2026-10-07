export function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function rankCandidates(postVector, candidates) {
  return candidates
    .map((c) => ({ ...c, score: cosine(postVector, c.embedding) }))
    .sort((x, y) => y.score - x.score);
}
