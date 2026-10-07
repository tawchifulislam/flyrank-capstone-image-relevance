import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { pool } from "../src/data/db.js";
import { env } from "../src/config/env.js";
import { scanCorpus } from "../src/logic/ingest.js";
import { insertImageIfNew } from "../src/data/imagesRepo.js";
import { saveTags } from "../src/data/tagRepo.js";
import { listImagesWithoutVector } from "../src/data/vectorRepo.js";
import { embedImage } from "../src/logic/embedImage.js";

const items = await scanCorpus(path.resolve(env.CORPUS_DIR));
for (const item of items) await insertImageIfNew(item);

const tags = JSON.parse(await readFile("seed/image-tags.json", "utf8"));
let loaded = 0;
for (const t of tags) {
  const { rows } = await pool.query("SELECT id, status FROM images WHERE file_path = $1", [t.file_path]);
  if (!rows.length || rows[0].status !== "pending") continue;
  const status = t.confidence < env.LOW_CONFIDENCE ? "flagged" : "tagged";
  await saveTags({ imageId: rows[0].id, metadata: t, status });
  loaded++;
}
console.log(`tags loaded: ${loaded}`);

const todo = await listImagesWithoutVector();
for (const meta of todo) {
  await embedImage(meta);
  await new Promise((r) => setTimeout(r, 700));
}
console.log(`embeddings created: ${todo.length}`);
await pool.end();
