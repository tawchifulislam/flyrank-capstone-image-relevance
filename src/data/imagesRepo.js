import { pool } from "./db.js";

export async function insertImageIfNew({ filePath, contentHash }) {
  const { rows } = await pool.query(
    `INSERT INTO images (file_path, content_hash)
     VALUES ($1, $2)
     ON CONFLICT (content_hash) DO NOTHING
     RETURNING id`,
    [filePath, contentHash]
  );
  return rows.length > 0;
}

export async function listImages({ status, limit, offset }) {
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = `WHERE i.status = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT i.id, i.file_path, i.status, m.subject, m.category, m.species, m.attributes, m.caption, m.confidence
     FROM images i
     LEFT JOIN image_metadata m ON m.image_id = i.id
     ${where}
     ORDER BY i.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

export async function listPendingIds() {
  const { rows } = await pool.query("SELECT id FROM images WHERE status = 'pending' ORDER BY id");
  return rows.map((r) => r.id);
}

export async function countByStatus() {
  const { rows } = await pool.query("SELECT status, COUNT(*)::int AS count FROM images GROUP BY status");
  const counts = { pending: 0, tagged: 0, flagged: 0, failed: 0 };
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}
