import { Router } from "express";
import { z } from "zod";
import { createPost } from "../logic/createPost.js";
import { suggestForPost, checkForcedImage } from "../logic/suggest.js";

export const postsRouter = Router();

const postBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

const idParam = z.coerce.number().int().min(1);

const ERROR_STATUS = {
  post_not_found: 404,
  image_not_found: 404,
  post_not_embedded: 409,
};

function sendResult(res, result) {
  if (result.error) return res.status(ERROR_STATUS[result.error] ?? 400).json({ error: result.error });
  return res.json(result);
}

postsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = postBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }
    res.status(201).json(await createPost(parsed.data));
  } catch (err) {
    next(err);
  }
});

postsRouter.get("/:id/images", async (req, res, next) => {
  try {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "invalid_id" });
    sendResult(res, await suggestForPost(id.data));
  } catch (err) {
    next(err);
  }
});

postsRouter.get("/:id/check/:imageId", async (req, res, next) => {
  try {
    const id = idParam.safeParse(req.params.id);
    const imageId = idParam.safeParse(req.params.imageId);
    if (!id.success || !imageId.success) return res.status(400).json({ error: "invalid_id" });
    sendResult(res, await checkForcedImage(id.data, imageId.data));
  } catch (err) {
    next(err);
  }
});
