import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { pool } from "../src/data/db.js";

const { rows } = await pool.query(
  `SELECT i.file_path, m.subject, m.category, m.species, m.attributes, m.caption, m.confidence
   FROM images i JOIN image_metadata m ON m.image_id = i.id
   ORDER BY i.file_path`
);
await mkdir("seed", { recursive: true });
await writeFile("seed/image-tags.json", JSON.stringify(rows, null, 2));
console.log(`exported ${rows.length} tag records`);
await pool.end();
