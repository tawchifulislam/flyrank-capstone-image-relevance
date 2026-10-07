import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("corpus");
const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".avif")).sort();

let i = 1;
for (const f of files) {
  const out = path.join(dir, `img_${String(i).padStart(3, "0")}.jpg`);
  await sharp(path.join(dir, f))
    .resize({ width: 1024, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(out);
  await unlink(path.join(dir, f));
  i++;
}
console.log(`converted ${files.length} images`);
