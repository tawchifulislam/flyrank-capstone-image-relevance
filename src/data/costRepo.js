import { pool } from "./db.js";

export async function insertCost({ callType, model, imageId = null, postId = null, inputTokens, outputTokens, costUsd }) {
  await pool.query(
    `INSERT INTO cost_log (call_type, model, image_id, post_id, input_tokens, output_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [callType, model, imageId, postId, inputTokens, outputTokens, costUsd]
  );
}

export async function sumCostToday() {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float AS total
     FROM cost_log
     WHERE created_at >= date_trunc('day', now())`
  );
  return rows[0].total;
}
