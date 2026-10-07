import { listImagesWithoutVector } from "../src/data/vectorRepo.js";
import { embedImage } from "../src/logic/embedImage.js";
import { pool } from "../src/data/db.js";

const rows = await listImagesWithoutVector();
console.log(`images to embed: ${rows.length}`);

let ok = 0;
let failed = 0;
for (const meta of rows) {
  try {
    const dim = await embedImage(meta);
    ok++;
    console.log(`embedded image ${meta.image_id} (${dim} dims)`);
  } catch (err) {
    failed++;
    console.error(`image ${meta.image_id} failed: ${err.message.slice(0, 200)}`);
  }
  await new Promise((r) => setTimeout(r, 700));
}

console.log(JSON.stringify({ ok, failed }));
await pool.end();
