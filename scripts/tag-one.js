import { tagImage } from "../src/logic/tagImage.js";
import { pool } from "../src/data/db.js";

const id = Number(process.argv[2] ?? 1);
const result = await tagImage(id);
console.log(JSON.stringify(result, null, 2));
await pool.end();
