import { pool } from "./db.js";

export async function saveSuggestions(postId, rows) {
  for (const r of rows) {
    await pool.query(
      `INSERT INTO suggestions (post_id, image_id, rank, score, guard_result, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (post_id, image_id) DO UPDATE SET
         rank = EXCLUDED.rank,
         score = EXCLUDED.score,
         guard_result = EXCLUDED.guard_result,
         reason = EXCLUDED.reason`,
      [postId, r.imageId, r.rank, r.score, r.guardResult, r.reason]
    );
  }
}

export async function getCandidateById(imageId) {
  const { rows } = await pool.query(
    `SELECT i.id AS image_id, i.file_path, v.embedding,
            m.subject, m.category, m.species, m.caption, m.confidence
     FROM image_vectors v
     JOIN images i ON i.id = v.image_id
     JOIN image_metadata m ON m.image_id = v.image_id
     WHERE i.id = $1`,
    [imageId]
  );
  return rows[0] ?? null;
}
