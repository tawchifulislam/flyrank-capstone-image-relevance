import { pool } from "./db.js";

export async function getSuggestion(id) {
  const { rows } = await pool.query(
    `SELECT s.id, s.post_id, s.image_id, s.rank, s.score, s.guard_result, s.reason,
            s.review_status, s.review_note, s.reviewed_at,
            p.title AS post_title, p.species AS post_species,
            i.file_path, m.subject AS image_subject, m.species AS image_species,
            m.caption AS image_caption, m.confidence AS image_confidence
     FROM suggestions s
     JOIN posts p ON p.id = s.post_id
     JOIN images i ON i.id = s.image_id
     LEFT JOIN image_metadata m ON m.image_id = s.image_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listSuggestions({ reviewStatus, guardResult, postId, limit, offset }) {
  const params = [];
  const where = [];
  if (reviewStatus) {
    params.push(reviewStatus);
    where.push(`s.review_status = $${params.length}`);
  }
  if (guardResult) {
    params.push(guardResult);
    where.push(`s.guard_result = $${params.length}`);
  }
  if (postId) {
    params.push(postId);
    where.push(`s.post_id = $${params.length}`);
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT s.id, s.post_id, s.image_id, s.rank, s.score, s.guard_result, s.reason,
            s.review_status, s.review_note, s.reviewed_at
     FROM suggestions s
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.post_id, s.rank
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

export async function setReview(id, status, note) {
  const { rows } = await pool.query(
    `UPDATE suggestions
     SET review_status = $2, review_note = $3, reviewed_at = now()
     WHERE id = $1 AND review_status = 'pending'
     RETURNING id`,
    [id, status, note]
  );
  return rows.length > 0;
}
