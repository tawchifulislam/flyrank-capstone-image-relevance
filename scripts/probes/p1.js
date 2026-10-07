import "dotenv/config";
import { pool } from "../../src/data/db.js";
import { visionSchema } from "../../src/ai/visionSchema.js";

const { rows } = await pool.query(
  `SELECT i.status, m.subject, m.category, m.species, m.attributes, m.caption, m.confidence
   FROM images i LEFT JOIN image_metadata m ON m.image_id = i.id`
);
const pending = rows.filter((r) => r.status === "pending").length;
const flagged = rows.filter((r) => r.status === "flagged").length;
const tagged = rows.filter((r) => r.status === "tagged").length;
const invalid = rows
  .filter((r) => r.status === "tagged" || r.status === "flagged")
  .filter((r) => !visionSchema.safeParse(r).success).length;

const ok = pending === 0 && flagged >= 1 && invalid === 0;
console.log(`PROBE 1 ${ok ? "PASS" : "FAIL"} | images ${rows.length} | tagged ${tagged} | flagged ${flagged} | pending ${pending} | schema-invalid ${invalid}`);
await pool.end();
process.exit(ok ? 0 : 1);
