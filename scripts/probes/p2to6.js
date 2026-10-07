const base = process.env.BASE_URL ?? "http://localhost:3000";

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

async function postId(title, body) {
  const created = await call("POST", "/posts", { title, body });
  return created.json.id;
}

const results = [];
function report(name, ok, detail) {
  results.push(ok);
  console.log(`${name} ${ok ? "PASS" : "FAIL"} | ${detail}`);
}

const fox = await postId("Probe: the red fox article", "An article about red foxes, how they hunt and raise their young.");
const foxResult = await call("GET", `/posts/${fox}/images`);
const species = foxResult.json.candidates.map((c) => c.species);
const top = foxResult.json.suggestion;
const lowest = foxResult.json.candidates.filter((c) => c.species !== "fox");
report(
  "PROBE 2",
  top?.species === "fox" && lowest.every((c) => c.guard === "rejected"),
  `top ${top?.filePath} (${top?.species}), non fox candidates in top 5: ${lowest.length}, all rejected: ${lowest.every((c) => c.guard === "rejected")}`
);

const wolf = await call("GET", "/images?limit=200");
const wolfImage = wolf.json.find((i) => i.species === "wolf");
const forced = await call("GET", `/posts/${fox}/check/${wolfImage.id}`);
report(
  "PROBE 3",
  forced.json.result === "rejected" && forced.json.reasons.some((r) => r.includes("mismatch")),
  `${forced.json.result} | ${forced.json.reasons.join("; ")}`
);

const none = await postId("Probe: laptop buying guide", "A comparison of affordable laptops with good battery life.");
const noneResult = await call("GET", `/posts/${none}/images`);
report(
  "PROBE 4",
  noneResult.json.suggestion === null && noneResult.json.message === "no confident match" && noneResult.json.reasons.length > 0,
  `${noneResult.json.message} | ${noneResult.json.reasons.join("; ")}`
);

const costs = await call("GET", "/costs?limit=1");
report(
  "PROBE 6",
  costs.json.totals.calls > 0 && costs.json.totals.unattributed === 0,
  `calls ${costs.json.totals.calls} | unattributed ${costs.json.totals.unattributed} | total usd ${costs.json.totals.totalUsd}`
);

process.exit(results.every(Boolean) ? 0 : 1);
