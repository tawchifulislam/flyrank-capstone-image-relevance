import "dotenv/config";
import { pool } from "../src/data/db.js";
import { env } from "../src/config/env.js";

const flagged = await pool.query(
  `UPDATE images SET status = 'flagged'
   WHERE status = 'tagged'
     AND id IN (SELECT image_id FROM image_metadata WHERE confidence < $1)
   RETURNING id`,
  [env.LOW_CONFIDENCE]
);
const restored = await pool.query(
  `UPDATE images SET status = 'tagged'
   WHERE status = 'flagged'
     AND id IN (SELECT image_id FROM image_metadata WHERE confidence >= $1)
   RETURNING id`,
  [env.LOW_CONFIDENCE]
);
console.log(JSON.stringify({ flagged: flagged.rows.map((r) => r.id), restored: restored.rows.map((r) => r.id) }));
await pool.end();
