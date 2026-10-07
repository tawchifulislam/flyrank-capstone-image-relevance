import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  VISION_MODEL: z.string().min(1),
  EMBEDDING_MODEL: z.string().min(1),
  LOW_CONFIDENCE: z.coerce.number().min(0).max(1),
  MIN_IMAGE_CONFIDENCE: z.coerce.number().min(0).max(1),
  MIN_SIMILARITY: z.coerce.number().min(0).max(1),
  DAILY_BUDGET_USD: z.coerce.number().positive(),
  CORPUS_DIR: z.string().default("corpus"),
  VISION_INPUT_USD_PER_M: z.coerce.number().min(0).default(0.3),
  VISION_OUTPUT_USD_PER_M: z.coerce.number().min(0).default(2.5),
  MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  SPECIES_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.76),
  SPECIES_AMBIGUITY_BAND: z.coerce.number().min(0).max(1).default(0.025),
  EMBEDDING_INPUT_USD_PER_M: z.coerce.number().min(0).default(0.15),
  INTER_CALL_DELAY_MS: z.coerce.number().int().min(0).default(4000),
});

export const env = schema.parse(process.env);
