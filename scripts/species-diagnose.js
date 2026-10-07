import 'dotenv/config';
import { pool } from '../src/data/db.js';
import { embedText } from '../src/ai/embedClient.js';
import { scoreSpecies } from '../src/logic/detectPostSubject.js';
import { postEmbeddingText } from '../src/logic/createPost.js';

const existing = [
  'Giraffes of the African savanna',
  'Meet the fawn',
  'Mule deer buck at dusk',
  'Deer grazing under Half Dome',
  'Elk and their antlers',
  'Sika deer in a city park',
  'A white wolf watching a field',
  'Training a corgi',
  'A fox mother and her kit',
  'Best budget laptops for students',
  'How to bake sourdough bread',
];

const unseen = [
  {
    title: 'Lions of the Serengeti',
    body: 'A pride of lions rests in the shade of an acacia tree on the plains.',
  },
  {
    title: 'Zebra stripes explained',
    body: 'Why zebras have black and white stripes and how they graze in herds.',
  },
  {
    title: 'Penguins on the ice',
    body: 'Emperor penguins huddle together on the ice to survive the winter.',
  },
  {
    title: 'Kangaroos in the outback',
    body: 'Red kangaroos hop across the dry Australian outback.',
  },
  {
    title: 'Wild horses on the plains',
    body: 'A herd of wild horses gallops across an open grassy plain.',
  },
  {
    title: 'Elephants at the waterhole',
    body: 'A family of elephants drinks and bathes at a waterhole in the dry season.',
  },
];

function line(title, scored) {
  const top = scored
    .slice(0, 3)
    .map(s => `${s.species} ${s.score.toFixed(3)}`)
    .join(' | ');
  console.log(`${title} | ${top}`);
}

for (const title of existing) {
  const { rows } = await pool.query(
    `SELECT v.embedding FROM posts p JOIN post_vectors v ON v.post_id = p.id WHERE p.title = $1 ORDER BY p.id LIMIT 1`,
    [title],
  );
  if (!rows.length) {
    console.log(`${title} | not in database`);
    continue;
  }
  line(title, await scoreSpecies(rows[0].embedding));
}

console.log('--- unseen posts ---');

for (const post of unseen) {
  const { values } = await embedText(postEmbeddingText(post));
  line(post.title, await scoreSpecies(values));
  await new Promise(r => setTimeout(r, 700));
}

await pool.end();
