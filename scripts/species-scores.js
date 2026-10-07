import { embedText } from "../src/ai/embedClient.js";
import { scoreSpecies } from "../src/logic/detectPostSubject.js";
import { postEmbeddingText } from "../src/logic/createPost.js";
import { pool } from "../src/data/db.js";

const samples = [
  { title: "The behavior of red foxes", body: "A look at how red foxes hunt, den and raise their young in the wild." },
  { title: "Vulpes vulpes in the wild", body: "Notes on the wild fox species and its habitat across Europe." },
  { title: "How wolf packs hunt", body: "Grey wolves coordinate in packs to take down large prey." },
  { title: "Deer in the autumn forest", body: "How deer move and feed through the forest as the seasons change." },
  { title: "Training a puppy", body: "Simple steps to teach your puppy to sit, stay and walk on a lead." },
  { title: "Best budget laptops for students", body: "A comparison of affordable laptops with good battery life." },
  { title: "How to bake sourdough bread", body: "A beginner guide to starter, folding and baking a crusty loaf." },
];

for (const s of samples) {
  const { values } = await embedText(postEmbeddingText(s));
  const scored = await scoreSpecies(values);
  const [a, b] = scored;
  console.log(
    `${s.title} | best: ${a.species} ${a.score.toFixed(3)} | second: ${b.species} ${b.score.toFixed(3)} | margin: ${(a.score - b.score).toFixed(3)}`
  );
  await new Promise((r) => setTimeout(r, 700));
}

await pool.end();
