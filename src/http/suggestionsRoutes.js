import { Router } from "express";
import { z } from "zod";
import { getSuggestion, listSuggestions } from "../data/reviewRepo.js";
import { reviewSuggestion } from "../logic/review.js";

export const suggestionsRouter = Router();

const idParam = z.coerce.number().int().min(1);

const listQuery = z.object({
  review_status: z.enum(["pending", "approved", "rejected"]).optional(),
  guard: z.enum(["passed", "rejected"]).optional(),
  post_id: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const reviewBody = z.object({
  note: z.string().trim().min(1).max(500).optional(),
});

const ERROR_STATUS = {
  suggestion_not_found: 404,
  already_reviewed: 409,
  cannot_approve_guard_rejected: 409,
};

suggestionsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
    }
    const q = parsed.data;
    res.json(
      await listSuggestions({
        reviewStatus: q.review_status,
        guardResult: q.guard,
        postId: q.post_id,
        limit: q.limit,
        offset: q.offset,
      })
    );
  } catch (err) {
    next(err);
  }
});

suggestionsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "invalid_id" });
    const suggestion = await getSuggestion(id.data);
    if (!suggestion) return res.status(404).json({ error: "suggestion_not_found" });
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
});

function reviewHandler(decision) {
  return async (req, res, next) => {
    try {
      const id = idParam.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ error: "invalid_id" });
      const body = reviewBody.safeParse(req.body ?? {});
      if (!body.success) {
        return res.status(400).json({ error: "invalid_body", details: body.error.flatten() });
      }
      const result = await reviewSuggestion(id.data, decision, body.data.note);
      if (result.error) return res.status(ERROR_STATUS[result.error] ?? 400).json({ error: result.error });
      res.json(result.suggestion);
    } catch (err) {
      next(err);
    }
  };
}

suggestionsRouter.post("/:id/approve", reviewHandler("approved"));
suggestionsRouter.post("/:id/reject", reviewHandler("rejected"));
