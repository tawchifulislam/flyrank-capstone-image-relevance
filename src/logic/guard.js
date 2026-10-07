function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function evaluateCandidate({ post, candidate, thresholds }) {
  const reasons = [];

  if (candidate.confidence < thresholds.minImageConfidence) {
    reasons.push(
      `Image tag confidence ${candidate.confidence.toFixed(2)} is below ${thresholds.minImageConfidence.toFixed(2)}`
    );
  }

  if (candidate.score < thresholds.minSimilarity) {
    reasons.push(
      `Similarity ${candidate.score.toFixed(2)} is below threshold ${thresholds.minSimilarity.toFixed(2)}`
    );
  }

  const expectedSet = post.speciesSet && post.speciesSet.length > 0 ? post.speciesSet : post.species ? [post.species] : [];

  if (expectedSet.length === 0) {
    reasons.push("No known subject detected in the post, so no image subject can be matched");
  } else if (post.category !== candidate.category) {
    reasons.push(`Category mismatch: expected ${post.category}, detected ${candidate.category}`);
  } else if (!expectedSet.includes(candidate.species)) {
    reasons.push(
      `${capitalize(post.category)} category mismatch: expected ${expectedSet.join(" or ")}, detected ${candidate.species}`
    );
  }

  return { passed: reasons.length === 0, reasons };
}
