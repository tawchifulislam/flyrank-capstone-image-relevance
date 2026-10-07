import { Router } from "express";
import path from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import { scanCorpus } from "../logic/ingest.js";
import { insertImageIfNew, listImages } from "../data/imagesRepo.js";

export const imagesRouter = Router();

imagesRouter.post("/ingest", async (req, res, next) => {
  try {
    const items = await scanCorpus(path.resolve(env.CORPUS_DIR));
    let added = 0;
    for (const item of items) {
      if (await insertImageIfNew(item)) added++;
    }
    res.status(202).json({ scanned: items.length, added, skipped: items.length - added });
  } catch (err) {
    next(err);
  }
});

const listQuery = z.object({
  status: z.enum(["pending", "tagged", "flagged", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

imagesRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
    }
    res.json(await listImages(parsed.data));
  } catch (err) {
    next(err);
  }
});
