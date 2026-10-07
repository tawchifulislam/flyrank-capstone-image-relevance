import { pool } from "./db.js";

export async function listSpecies() {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (species) species, category
     FROM (
       SELECT species, category, COUNT(*) AS c
       FROM image_metadata
       WHERE species <> 'none'
       GROUP BY species, category
     ) t
     ORDER BY species, c DESC`
  );
  return rows;
}
