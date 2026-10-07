import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { describeImage } from "../ai/visionClient.js";
import { getImage, insertJobRun, saveTags, markStatus } from "../data/tagRepo.js";
import { insertCost, sumCostToday } from "../data/costRepo.js";

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function costOf(usage) {
  return (
    (usage.inputTokens / 1_000_000) * env.VISION_INPUT_USD_PER_M +
    (usage.outputTokens / 1_000_000) * env.VISION_OUTPUT_USD_PER_M
  );
}

export async function tagImage(imageId) {
  const image = await getImage(imageId);
  if (!image) return { imageId, outcome: "not_found" };

  const buffer = await readFile(path.resolve(image.file_path));
  const mimeType = MIME[path.extname(image.file_path).toLowerCase()];
  const base64 = buffer.toString("base64");

  let lastError = "unknown error";
  for (let attempt = 1; attempt <= env.MAX_ATTEMPTS; attempt++) {
    if ((await sumCostToday()) >= env.DAILY_BUDGET_USD) {
      await insertJobRun({ imageId, attempt, status: "budget_stopped", error: "daily budget reached" });
      return { imageId, outcome: "budget_stopped" };
    }

    let result;
    try {
      result = await describeImage({ base64, mimeType });
    } catch (err) {
      lastError = err.message;
      await insertJobRun({ imageId, attempt, status: "error", error: lastError });
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      continue;
    }

    await insertCost({
      callType: "vision",
      model: env.VISION_MODEL,
      imageId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: costOf(result.usage),
    });

    if (!result.ok) {
      lastError = result.error;
      await insertJobRun({ imageId, attempt, status: "invalid", error: lastError });
      continue;
    }

    const status = result.data.confidence < env.LOW_CONFIDENCE ? "flagged" : "tagged";
    await saveTags({ imageId, metadata: result.data, status });
    await insertJobRun({ imageId, attempt, status: "ok" });
    return { imageId, outcome: status, metadata: result.data };
  }

  await markStatus(imageId, "failed");
  console.error(`image ${imageId} failed after ${env.MAX_ATTEMPTS} attempts: ${lastError}`);
  return { imageId, outcome: "failed", error: lastError };
}
