import express from "express";
import { imagesRouter } from "./imagesRoutes.js";

export const app = express();

app.use(express.json());
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/images", imagesRouter);

app.use((req, res) => res.status(404).json({ error: "not_found" }));

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: "internal_error" });
});
