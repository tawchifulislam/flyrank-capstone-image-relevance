import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export async function scanCorpus(dir) {
  const names = (await readdir(dir))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  const items = [];
  for (const name of names) {
    const buffer = await readFile(path.join(dir, name));
    items.push({
      filePath: path.posix.join(path.basename(dir), name),
      contentHash: createHash("sha256").update(buffer).digest("hex"),
    });
  }
  return items;
}
