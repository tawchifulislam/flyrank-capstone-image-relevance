import { z } from "zod";

const lower = z.string().trim().min(1).transform((s) => s.toLowerCase());

export const visionSchema = z.object({
  subject: lower,
  category: lower,
  species: lower,
  attributes: z.array(lower).min(1).max(8),
  caption: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});
