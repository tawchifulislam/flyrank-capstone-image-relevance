import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { pool } from '../src/data/db.js';
import { env } from '../src/config/env.js';
import { createPost } from '../src/logic/createPost.js';
import { suggestForPost, checkForcedImage } from '../src/logic/suggest.js';
import { getPostVector } from '../src/data/postsRepo.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = p => (p ? p.split('/').pop() : 'none');

async function ensurePost({ title, body }) {
  const found = await pool.query(
    'SELECT id FROM posts WHERE title = $1 ORDER BY id LIMIT 1',
    [title],
  );
  if (found.rows.length) {
    const id = found.rows[0].id;
    if (await getPostVector(id)) return id;
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
  }
  const post = await createPost({ title, body });
  await sleep(700);
  return post.id;
}

const set = JSON.parse(await readFile('eval/eval-set.json', 'utf8'));
const heldOut = JSON.parse(await readFile('eval/held-out.json', 'utf8'));
const heldNoMatch = JSON.parse(await readFile("eval/held-out-no-match.json", "utf8"));
const rows = [];

async function runTop1(kind, cases) {
  let correct = 0;
  for (const c of cases) {
    const id = await ensurePost(c);
    const result = await suggestForPost(id);
    const got = result.suggestion?.filePath ?? null;
    const ok = got === `corpus/${c.expectedImage}`;
    if (ok) correct++;
    rows.push({
      kind,
      title: c.title,
      expected: c.expectedImage,
      got: base(got),
      score: result.suggestion?.score ?? null,
      topScore: result.candidates[0]?.score ?? null,
      accepted: result.detected.accepted,
      ok,
    });
    console.log(
      `${ok ? 'PASS' : 'FAIL'} | ${kind} | ${c.title} | expected ${c.expectedImage} | got ${base(got)} | top score ${result.candidates[0]?.score}`,
    );
  }
  return correct;
}

const correct = await runTop1('top1', set.cases);
const heldCorrect = await runTop1('held-out', heldOut);

let synOk = 0;
for (const c of set.synonymCases) {
  const id = await ensurePost(c);
  const result = await suggestForPost(id);
  const ok = result.suggestion?.species === c.expectedSpecies;
  if (ok) synOk++;
  rows.push({
    kind: 'synonym',
    title: c.title,
    expectedSpecies: c.expectedSpecies,
    gotSpecies: result.suggestion?.species ?? null,
    ok,
  });
  console.log(
    `${ok ? 'PASS' : 'FAIL'} | synonym | ${c.title} | expected ${c.expectedSpecies} | got ${result.suggestion?.species ?? 'no match'}`,
  );
}

let noMatchOk = 0;
for (const c of [...set.noMatchCases, ...heldNoMatch]) {
  const id = await ensurePost(c);
  const result = await suggestForPost(id);
  const ok = result.suggestion === null;
  if (ok) noMatchOk++;
  rows.push({ kind: 'no_match', title: c.title, ok, reasons: result.reasons });
  console.log(
    `${ok ? 'PASS' : 'FAIL'} | no match | ${c.title} | ${ok ? result.reasons[0] : `suggested ${base(result.suggestion.filePath)}`}`,
  );
}

let forcedOk = 0;
for (const c of set.forcedCases) {
  const post = await pool.query(
    'SELECT id FROM posts WHERE title = $1 ORDER BY id LIMIT 1',
    [c.postTitle],
  );
  const image = await pool.query('SELECT id FROM images WHERE file_path = $1', [
    `corpus/${c.image}`,
  ]);
  const result = await checkForcedImage(post.rows[0].id, image.rows[0].id);
  const ok = result.result === c.expect;
  if (ok) forcedOk++;
  rows.push({
    kind: 'forced',
    postTitle: c.postTitle,
    image: c.image,
    result: result.result,
    reasons: result.reasons,
    ok,
  });
  console.log(
    `${ok ? 'PASS' : 'FAIL'} | forced | ${c.postTitle} + ${c.image} | ${result.result} | ${result.reasons.join('; ')}`,
  );
}

const summary = {
  top1Precision: Number((correct / set.cases.length).toFixed(4)),
  top1Correct: correct,
  top1Total: set.cases.length,
  heldOutPrecision: Number((heldCorrect / heldOut.length).toFixed(4)),
  heldOutCorrect: heldCorrect,
  heldOutTotal: heldOut.length,
  synonymCorrect: `${synOk}/${set.synonymCases.length}`,
  noMatchCorrect: `${noMatchOk}/${set.noMatchCases.length + heldNoMatch.length}`,
  forcedRejected: `${forcedOk}/${set.forcedCases.length}`,
  thresholds: {
    minSimilarity: env.MIN_SIMILARITY,
    minImageConfidence: env.MIN_IMAGE_CONFIDENCE,
    speciesMinScore: env.SPECIES_MIN_SCORE,
    speciesAmbiguityBand: env.SPECIES_AMBIGUITY_BAND,
  },
};

await writeFile(
  'eval/last-run.json',
  JSON.stringify({ summary, rows }, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
await pool.end();
