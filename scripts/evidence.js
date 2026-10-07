import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pool } from '../src/data/db.js';
import { visionSchema } from '../src/ai/visionSchema.js';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const fence = '`'.repeat(3);
const out = [];

const block = text => `${fence}\n${text}\n${fence}`;
const json = v => JSON.stringify(v, null, 2);

async function http(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function sql(query, params) {
  const { rows } = await pool.query(query, params);
  return rows;
}

function table(rows) {
  if (!rows.length) return '(no rows)';
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(' | ')];
  for (const r of rows)
    lines.push(cols.map(c => String(r[c] ?? '')).join(' | '));
  return lines.join('\n');
}

async function grep(file, pattern) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  const re = new RegExp(pattern);
  return lines
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(x => re.test(x.l))
    .map(x => `${file}:${x.n}: ${x.l.trim()}`)
    .join('\n');
}

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    return `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
  }
}

function section(num, title, requirement, parts) {
  out.push(
    `## ${num}. ${title}\n\nRequirement: ${requirement}\n\n${parts.join('\n\n')}\n`,
  );
}

function brief(r) {
  return {
    status: r.status,
    postId: r.body.postId,
    detected: r.body.detected,
    message: r.body.message,
    reasons: r.body.reasons,
    candidates: (r.body.candidates ?? []).map(c => ({
      rank: c.rank,
      file: c.filePath,
      species: c.species,
      score: c.score,
      guard: c.guard,
      reasons: c.reasons,
    })),
  };
}

const commit = run('git rev-parse --short HEAD');
const lastRun = JSON.parse(await readFile('eval/last-run.json', 'utf8'));

const foxPost = await http('POST', '/posts', {
  title: 'Evidence: the red fox article',
  body: 'An article about red foxes, how they hunt and raise their young.',
});
const foxId = foxPost.body.id;
const foxRank = await http('GET', `/posts/${foxId}/images`);

const latinPost = await http('POST', '/posts', {
  title: 'Evidence: Vulpes vulpes in the wild',
  body: 'Notes on the wild fox species Vulpes vulpes and its habitat.',
});
const latinRank = await http('GET', `/posts/${latinPost.body.id}/images`);

const wolfRow = (
  await sql(
    "SELECT i.id, i.file_path FROM images i JOIN image_metadata m ON m.image_id = i.id WHERE m.species = 'wolf' ORDER BY i.id LIMIT 1",
  )
)[0];
const forced = await http('GET', `/posts/${foxId}/check/${wolfRow.id}`);

const lapPost = await http('POST', '/posts', {
  title: 'Evidence: laptop buying guide',
  body: 'A comparison of affordable laptops with good battery life.',
});
const lapRank = await http('GET', `/posts/${lapPost.body.id}/images`);

out.push(
  `# EVIDENCE\n\nOne proof per requirement from section 6 of the capstone brief. Every output below was produced by running \`node scripts/evidence.js\` against the running system at commit \`${commit}\` on ${new Date().toISOString()}.\n`,
);

const probeOutput = [
  run('node scripts/probes/p1.js'),
  run('node scripts/probes/p2to6.js'),
].join('\n');
const s = lastRun.summary;
out.push(
  `## Acceptance probes\n\n${block(
    `${probeOutput}\nPROBE 5 | top1 ${s.top1Precision} (${s.top1Correct}/${s.top1Total}) held-out ${s.heldOutPrecision} (${s.heldOutCorrect}/${s.heldOutTotal}) synonym ${s.synonymCorrect} no-match ${s.noMatchCorrect} forced ${s.forcedRejected}`,
  )}\n`,
);

const badSamples = [
  {
    name: 'confidence above 1',
    value: {
      subject: 'red fox',
      category: 'animal',
      species: 'fox',
      attributes: ['fur'],
      caption: 'A fox',
      confidence: 1.7,
    },
  },
  {
    name: 'missing species',
    value: {
      subject: 'red fox',
      category: 'animal',
      attributes: ['fur'],
      caption: 'A fox',
      confidence: 0.9,
    },
  },
  {
    name: 'empty attributes',
    value: {
      subject: 'red fox',
      category: 'animal',
      species: 'fox',
      attributes: [],
      caption: 'A fox',
      confidence: 0.9,
    },
  },
  {
    name: 'wrong type for confidence',
    value: {
      subject: 'red fox',
      category: 'animal',
      species: 'fox',
      attributes: ['fur'],
      caption: 'A fox',
      confidence: 'high',
    },
  },
];
const schemaLines = badSamples.map(b => {
  const r = visionSchema.safeParse(b.value);
  return `${b.name}: ${r.success ? 'ACCEPTED' : 'rejected | ' + r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
});
const goodCheck = visionSchema.safeParse({
  subject: 'red fox',
  category: 'animal',
  species: 'fox',
  attributes: ['orange fur', 'forest'],
  caption: 'A red fox in a forest',
  confidence: 0.94,
});
schemaLines.push(
  `valid sample: ${goodCheck.success ? 'accepted' : 'REJECTED'}`,
);
section(
  1,
  'Structured output validated against a schema',
  'Vision model produces structured output validated against a schema; invalid responses are never trusted.',
  [
    'Schema check on invalid and valid model outputs:',
    block(schemaLines.join('\n')),
    'Where it is enforced:',
    block(
      `${await grep('src/ai/visionClient.js', 'safeParse|responseMimeType')}\n${await grep('src/logic/tagImage.js', 'result.ok|invalid|markStatus')}`,
    ),
  ],
);

section(
  2,
  'Low confidence classifications are flagged',
  'Low-confidence classifications are flagged instead of accepted.',
  [
    `LOW_CONFIDENCE is ${process.env.LOW_CONFIDENCE}. Images below it:`,
    block(
      table(
        await sql(
          "SELECT regexp_replace(i.file_path, '^corpus/', '') AS file, i.status, m.species, m.confidence FROM images i JOIN image_metadata m ON m.image_id = i.id WHERE i.status = 'flagged' ORDER BY i.id",
        ),
      ),
    ),
    'Status counts:',
    block(
      table(
        await sql(
          'SELECT status, COUNT(*)::int AS images FROM images GROUP BY status ORDER BY status',
        ),
      ),
    ),
  ],
);

section(
  3,
  'Batch background job with retries',
  'Images are processed through a batch background job with retries.',
  [
    'Job runs by status (error rows are retries, ok rows are successes):',
    block(
      table(
        await sql(
          'SELECT status, COUNT(*)::int AS runs FROM job_runs GROUP BY status ORDER BY status',
        ),
      ),
    ),
    'Most recent runs:',
    block(
      table(
        await sql(
          "SELECT image_id, attempt, status, LEFT(COALESCE(error, ''), 80) AS error FROM job_runs ORDER BY id DESC LIMIT 10",
        ),
      ),
    ),
    'Job and retry definitions:',
    block(
      `${await grep('src/jobs/processImages.js', 'createFunction|retries|concurrency|onFailure|ALERT')}\n${await grep('src/logic/tagImage.js', 'MAX_ATTEMPTS|sleep|quota_stopped|ALERT')}`,
    ),
  ],
);

const costs = await http('GET', '/costs?limit=3');
section(
  4,
  'Costs tracked per call',
  'Vision and embedding costs are tracked per call.',
  [
    'GET /costs?limit=3:',
    block(json(costs.body)),
    'Every call row carries an image, a post or a label (unattributed must be 0):',
    block(
      table(
        await sql(
          'SELECT call_type, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE image_id IS NULL AND post_id IS NULL AND label IS NULL)::int AS unattributed FROM cost_log GROUP BY call_type ORDER BY call_type',
        ),
      ),
    ),
  ],
);

section(
  5,
  'Embeddings stored and ranked suggestions returned',
  'Image and post embeddings are stored; posts return ranked image suggestions.',
  [
    block(
      table(
        await sql(
          "SELECT 'image_vectors' AS stored, COUNT(*)::int AS rows, MIN(array_length(embedding, 1))::int AS dims FROM image_vectors UNION ALL SELECT 'post_vectors', COUNT(*)::int, MIN(array_length(embedding, 1))::int FROM post_vectors",
        ),
      ),
    ),
    'GET /posts/:id/images for the red fox article:',
    block(json(brief(foxRank))),
  ],
);

section(
  6,
  'Semantic matching of equivalent concepts',
  'Semantic matching works for equivalent concepts, so "red fox" matches "Vulpes vulpes".',
  [
    'A post that only says Vulpes vulpes and wild fox species:',
    block(json(brief(latinRank))),
  ],
);

section(
  7,
  'The guard rejects the wolf on a fox post',
  'The mismatch guard rejects incorrect recommendations; the wolf-on-a-fox-post scenario provably fails.',
  [
    `Forcing ${wolfRow.file_path} as a candidate for the red fox post:`,
    block(json(forced.body)),
    'Second forced case from the eval run:',
    block(json(lastRun.rows.filter(r => r.kind === 'forced'))),
  ],
);

section(
  8,
  'Rejections explain themselves',
  'Rejections include a human-readable explanation.',
  [
    'Every rejection above carries a reasons list. Persisted rejections in the suggestions table:',
    block(
      table(
        await sql(
          "SELECT post_id, image_id, rank, guard_result, LEFT(reason, 110) AS reason FROM suggestions WHERE guard_result = 'rejected' ORDER BY id DESC LIMIT 6",
        ),
      ),
    ),
  ],
);

section(
  9,
  'No confident match with reasons',
  'When no image clears the bar, the system answers "no confident match" with reasons.',
  [
    'A laptop post against an animal image library:',
    block(json(brief(lapRank))),
  ],
);

const tables = await sql(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
const indexes = await sql(
  "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname",
);
section(
  10,
  'Database models and indexes',
  'Database models for images, tags, embeddings, posts, suggestions, approvals and rejections, with the required indexes.',
  [
    'Tables:',
    block(tables.map(t => t.table_name).join('\n')),
    'Indexes:',
    block(table(indexes)),
    'Migrations applied:',
    block(table(await sql('SELECT name FROM schema_migrations ORDER BY name'))),
  ],
);

const passedList = await http(
  'GET',
  `/suggestions?post_id=${foxId}&guard=passed&limit=2`,
);
const rejectedList = await http(
  'GET',
  `/suggestions?post_id=${lapPost.body.id}&guard=rejected&limit=1`,
);
const p1 = passedList.body[0].id;
const p2 = passedList.body[1].id;
const rj = rejectedList.body[0].id;
const steps = [];
async function step(label, method, path, body) {
  const r = await http(method, path, body);
  steps.push(
    `${label}: ${method} ${path} -> ${r.status} ${typeof r.body === 'object' ? JSON.stringify(r.body.error ?? r.body.review_status ?? 'ok') : r.body}`,
  );
}
await step('invalid body', 'POST', '/posts', { title: 'Hello', body: '' });
await step('invalid query', 'GET', '/images?status=bogus');
await step('invalid query', 'GET', '/costs?limit=0');
await step('unknown id', 'GET', '/suggestions/99999');
await step('approve', 'POST', `/suggestions/${p1}/approve`);
await step('approve again', 'POST', `/suggestions/${p1}/approve`);
await step('reject after approve', 'POST', `/suggestions/${p1}/reject`);
await step('reject with note', 'POST', `/suggestions/${p2}/reject`, {
  note: 'Not the best crop for the article',
});
await step('approve guard rejected', 'POST', `/suggestions/${rj}/approve`);
const inspected = await http('GET', `/suggestions/${p2}`);
section(
  11,
  'Validated endpoints and review workflow',
  'API endpoints are validated; the review workflow (approve / reject / inspect why) exists.',
  [
    'Validation and review workflow transcript:',
    block(steps.join('\n')),
    'Inspect why an image was selected (GET /suggestions/:id):',
    block(json(inspected.body)),
  ],
);

const readme = await readFile('README.md', 'utf8');
section(
  12,
  'Eval set and top-1 precision',
  'A small labelled evaluation dataset measures top-1 precision; the number is in the README.',
  [
    'eval/last-run.json summary:',
    block(json(lastRun.summary)),
    'Matching lines in README.md:',
    block(
      readme
        .split('\n')
        .filter(l => /top-1|16 of 16|1\.00/i.test(l))
        .join('\n'),
    ),
    'Labelled cases per group:',
    block(
      Object.entries(
        lastRun.rows.reduce(
          (a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }),
          {},
        ),
      )
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'),
    ),
  ],
);

const required = [
  'README.md',
  'capstone.yaml',
  'EVIDENCE.md',
  'BUILDLOG.md',
  '.env.example',
  'DESIGN.md',
  'LICENSE',
];
const ignored = run('git check-ignore -v .env');
const tracked = run('git ls-files .env');
section(
  13,
  'README and required files',
  'README with architecture explanation and diagram; the required files from section 11 are present.',
  [
    'Required files (EVIDENCE.md is this file and exists after the script writes it):',
    block(
      required
        .map(
          f =>
            `${f}: ${f === 'EVIDENCE.md' || existsSync(f) ? 'present' : 'MISSING'}`,
        )
        .join('\n'),
    ),
    'capstone.yaml:',
    block(await readFile('capstone.yaml', 'utf8')),
    'README has an architecture section and diagram:',
    block(
      readme
        .split('\n')
        .filter(l => /^## Architecture|-> |--> /.test(l))
        .slice(0, 6)
        .join('\n'),
    ),
    'Secrets are not committed (.env is ignored and not tracked):',
    block(
      `git check-ignore -v .env\n${ignored}\ngit ls-files .env\n${tracked || '(not tracked)'}`,
    ),
  ],
);

await writeFile('EVIDENCE.md', out.join('\n'));
console.log(`EVIDENCE.md written, ${out.length} sections, commit ${commit}`);
await pool.end();
