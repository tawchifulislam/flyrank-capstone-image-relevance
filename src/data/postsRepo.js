import { pool } from "./db.js";

export async function insertPost({ title, body }) {
  const { rows } = await pool.query(
    "INSERT INTO posts (title, body) VALUES ($1, $2) RETURNING id, title, body, created_at",
    [title, body]
  );
  return rows[0];
}

export async function getPost(id) {
  const { rows } = await pool.query(
    "SELECT id, title, body, subject, category, species FROM posts WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function getPostVector(postId) {
  const { rows } = await pool.query("SELECT embedding FROM post_vectors WHERE post_id = $1", [postId]);
  return rows[0]?.embedding ?? null;
}

export async function listImageCandidates() {
  const { rows } = await pool.query(
    `SELECT i.id AS image_id, i.file_path, v.embedding,
            m.subject, m.category, m.species, m.caption, m.confidence
     FROM image_vectors v
     JOIN images i ON i.id = v.image_id
     JOIN image_metadata m ON m.image_id = v.image_id`
  );
  return rows;
}

export async function updatePostSubject(id, { subject, category, species }) {
  await pool.query(
    "UPDATE posts SET subject = $2, category = $3, species = $4 WHERE id = $1",
    [id, subject, category, species]
  );
}
