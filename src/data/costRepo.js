import { pool } from "./db.js";

export async function insertCost({ callType, model, imageId = null, postId = null, label = null, inputTokens, outputTokens, costUsd }) {
  await pool.query(
    `INSERT INTO cost_log (call_type, model, image_id, post_id, label, input_tokens, output_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [callType, model, imageId, postId, label, inputTokens, outputTokens, costUsd]
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

export async function costSummary() {
  const { rows } = await pool.query(
    `SELECT call_type, model,
            COUNT(*)::int AS calls,
            SUM(input_tokens)::int AS input_tokens,
            SUM(output_tokens)::int AS output_tokens,
            ROUND(SUM(cost_usd), 6)::float AS total_usd,
            COUNT(*) FILTER (WHERE image_id IS NULL AND post_id IS NULL AND label IS NULL)::int AS unattributed
     FROM cost_log
     GROUP BY call_type, model
     ORDER BY call_type, model`
  );
  return rows;
}

export async function recentCosts(limit) {
  const { rows } = await pool.query(
    `SELECT id, call_type, model, image_id, post_id, label, input_tokens, output_tokens, cost_usd::float AS cost_usd, created_at
     FROM cost_log ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
