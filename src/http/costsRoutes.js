import { Router } from "express";
import { z } from "zod";
import { costSummary, recentCosts } from "../data/costRepo.js";

export const costsRouter = Router();

const query = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(20),
});

costsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
    }
    const byType = await costSummary();
    const totals = {
      calls: byType.reduce((n, r) => n + r.calls, 0),
      totalUsd: Number(byType.reduce((n, r) => n + r.total_usd, 0).toFixed(6)),
      unattributed: byType.reduce((n, r) => n + r.unattributed, 0),
    };
    res.json({ totals, byType, recent: await recentCosts(parsed.data.limit) });
  } catch (err) {
    next(err);
  }
});
