import express from "express";
import { serve } from "inngest/express";
import { imagesRouter } from "./imagesRoutes.js";
import { jobsRouter } from "./jobsRoutes.js";
import { postsRouter } from "./postsRoutes.js";
import { suggestionsRouter } from "./suggestionsRoutes.js";
import { inngest } from "../jobs/client.js";
import { processImages } from "../jobs/processImages.js";

export const app = express();

app.use(express.json());
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/inngest", serve({ client: inngest, functions: [processImages] }));
app.use("/images", imagesRouter);
app.use("/jobs", jobsRouter);
app.use("/posts", postsRouter);
app.use("/suggestions", suggestionsRouter);

app.use((req, res) => res.status(404).json({ error: "not_found" }));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: "internal_error" });
});
