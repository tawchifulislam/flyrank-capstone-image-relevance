import { pool } from "./db.js";

export async function saveImageVector({ imageId, embedding, model }) {
  await pool.query(
    `INSERT INTO image_vectors (image_id, embedding, model)
     VALUES ($1, $2, $3)
     ON CONFLICT (image_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model`,
    [imageId, embedding, model]
  );
}

export async function savePostVector({ postId, embedding, model }) {
  await pool.query(
    `INSERT INTO post_vectors (post_id, embedding, model)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model`,
    [postId, embedding, model]
  );
}

export async function listImagesWithoutVector() {
  const { rows } = await pool.query(
    `SELECT m.image_id, m.subject, m.species, m.attributes, m.caption
     FROM image_metadata m
     LEFT JOIN image_vectors v ON v.image_id = m.image_id
     WHERE v.image_id IS NULL
     ORDER BY m.image_id`
  );
  return rows;
}
