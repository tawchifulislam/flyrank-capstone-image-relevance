import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const dir = path.resolve("migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const { rows } = await client.query("SELECT name FROM schema_migrations");
const applied = new Set(rows.map((r) => r.name));

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(path.join(dir, file), "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`failed ${file}: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("migrations up to date");
