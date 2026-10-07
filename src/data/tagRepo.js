import { pool } from "./db.js";

export async function getImage(id) {
  const { rows } = await pool.query("SELECT id, file_path, status FROM images WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function insertJobRun({ imageId, attempt, status, error = null }) {
  await pool.query(
    "INSERT INTO job_runs (image_id, attempt, status, error) VALUES ($1, $2, $3, $4)",
    [imageId, attempt, status, error]
  );
}

export async function saveTags({ imageId, metadata, status }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO image_metadata (image_id, subject, category, species, attributes, caption, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (image_id) DO UPDATE SET
         subject = EXCLUDED.subject,
         category = EXCLUDED.category,
         species = EXCLUDED.species,
         attributes = EXCLUDED.attributes,
         caption = EXCLUDED.caption,
         confidence = EXCLUDED.confidence`,
      [imageId, metadata.subject, metadata.category, metadata.species, metadata.attributes, metadata.caption, metadata.confidence]
    );
    await client.query("UPDATE images SET status = $2 WHERE id = $1", [imageId, status]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function markStatus(imageId, status) {
  await pool.query("UPDATE images SET status = $2 WHERE id = $1", [imageId, status]);
}
