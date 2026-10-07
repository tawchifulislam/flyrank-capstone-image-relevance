import { getSuggestion, setReview } from "../data/reviewRepo.js";

export async function reviewSuggestion(id, decision, note) {
  const current = await getSuggestion(id);
  if (!current) return { error: "suggestion_not_found" };

  if (current.review_status === decision) {
    return { suggestion: current, unchanged: true };
  }
  if (current.review_status !== "pending") {
    return { error: "already_reviewed" };
  }
  if (decision === "approved" && current.guard_result === "rejected") {
    return { error: "cannot_approve_guard_rejected" };
  }

  await setReview(id, decision, note ?? null);
  return { suggestion: await getSuggestion(id), unchanged: false };
}
