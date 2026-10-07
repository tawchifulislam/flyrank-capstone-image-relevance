import { Router } from "express";
import { z } from "zod";
import { createPost } from "../logic/createPost.js";
import { rankCandidates } from "../logic/similarity.js";
import { getPost, getPostVector, listImageCandidates } from "../data/postsRepo.js";

export const postsRouter = Router();

const postBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

postsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = postBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const post = await createPost(parsed.data);
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

postsRouter.get("/:id/images", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "invalid_id" });
    }
    const post = await getPost(id);
    if (!post) return res.status(404).json({ error: "post_not_found" });

    const vector = await getPostVector(id);
    if (!vector) return res.status(409).json({ error: "post_not_embedded" });

    const ranked = rankCandidates(vector, await listImageCandidates()).slice(0, 5);
    res.json({
      postId: id,
      candidates: ranked.map((c, i) => ({
        rank: i + 1,
        imageId: c.image_id,
        filePath: c.file_path,
        score: Number(c.score.toFixed(4)),
        subject: c.subject,
        species: c.species,
        caption: c.caption,
      })),
    });
  } catch (err) {
    next(err);
  }
});
