import { Router } from "express";
import { inngest } from "../jobs/client.js";
import { countByStatus } from "../data/imagesRepo.js";

export const jobsRouter = Router();

jobsRouter.post("/process-images", async (req, res, next) => {
  try {
    const counts = await countByStatus();
    if (counts.pending === 0) {
      return res.status(200).json({ message: "no pending images", counts });
    }
    const { ids } = await inngest.send({ name: "images/process.requested", data: {} });
    res.status(202).json({ jobId: ids[0], pending: counts.pending });
  } catch (err) {
    next(err);
  }
});

jobsRouter.get("/:id", async (req, res, next) => {
  try {
    const counts = await countByStatus();
    const total = counts.pending + counts.tagged + counts.flagged + counts.failed;
    const done = counts.tagged + counts.flagged + counts.failed;
    res.json({ jobId: req.params.id, total, done, ...counts, finished: counts.pending === 0 });
  } catch (err) {
    next(err);
  }
});
