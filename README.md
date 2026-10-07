# AI Image Understanding and Content Matching Engine

A service that looks at an image library, understands what is in each image, tags it, and matches the right image to the right blog post by meaning, not by file names or keywords. When no image is a good enough match, it says so with a reason instead of guessing.

Example behaviour: a post about red foxes surfaces a red fox photo, a similar looking wolf is rejected with an explanation, and a post about laptops gets "no confident match".

## Stack

- Node.js and Express, ES modules
- Gemini vision model for tagging and Gemini embeddings for matching (free tier, no credit card)
- Zod for schema validation
- PostgreSQL in Docker, vectors stored as arrays (about 50 images, so pgvector is not needed)
- Inngest dev server for the background batch job

## Architecture

```text
corpus images
    |  POST /jobs/process-images (Inngest batch job, retries, cost log)
    v
Vision model --> {subject, category, species, attributes, caption, confidence}
    |                 validated by Zod, low confidence is flagged
    |  embed(caption + subject + attributes)
    v
image_metadata + image_vectors

posts --> embed(title + body) --> post_vectors
          species detection: compare with embedded species names

GET /posts/:id/images
    -> cosine similarity ranking (image_vectors x post_vector)
        -> mismatch guard (confidence, similarity, category, species)
            -> suggested image, or "no confident match" with reasons
                -> review API: approve / reject / inspect
```

Layers: `src/http` (routes), `src/logic` (matching, guard, ranking), `src/data` (SQL), `src/ai` (model clients and schemas), `src/jobs` (batch job). The guard in `src/logic/guard.js` is a pure function with no imports.

See `DESIGN.md` for the data model and the decisions made during implementation.

## Run it

Requirements: Node.js 20 or newer, Docker, and a free Gemini API key from Google AI Studio (no credit card).

```text
git clone https://github.com/tawchifulislam/flyrank-capstone-image-relevance.git
cd flyrank-capstone-image-relevance
npm install
cp .env.example .env
```

Put your key in `.env` as `GEMINI_API_KEY`. Then:

```text
npm run up
```

This starts Postgres, applies the migrations and starts the server on port 3000.

## Seed the demo data

In a second terminal:

```text
npm run seed
```

The seed script registers the 54 corpus images, loads the saved vision tags from `seed/image-tags.json` (so no vision quota is used), and creates the embeddings. The tags are real model outputs exported from an earlier run.

To run the live vision job instead, start the Inngest dev server and call the job endpoints:

```text
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
curl -X POST localhost:3000/images/ingest
curl -X POST localhost:3000/jobs/process-images
curl localhost:3000/jobs/anything
```

## Tests and evaluation

```text
npm test
```

Runs the six acceptance probes against the running system. `npm run eval` runs only the evaluation set and writes `eval/last-run.json`.

| Probe | What it checks |
| ------- | ---------------- |
| 1 | Every image has schema valid tags and at least one low confidence image is flagged, none left pending |
| 2 | The red fox post ranks a fox image first and no non fox candidate passes the guard |
| 3 | Forcing a wolf image onto the fox post is rejected with a category mismatch explanation |
| 4 | A post with no suitable image returns "no confident match" with reasons |
| 5 | The eval script runs and reports top-1 precision, matching the number below |
| 6 | Every vision and embedding call has a cost entry attributed to an image, a post or a label |

## API

| Method | Path | Purpose |
| -------- | ------ | --------- |
| POST | `/images/ingest` | Register corpus images, returns 202 |
| GET | `/images` | List images, filter by `status` |
| POST | `/jobs/process-images` | Start the batch job, returns 202 |
| GET | `/jobs/:id` | Progress counts |
| POST | `/posts` | Create a post and embed it |
| GET | `/posts/:id/images` | Ranked candidates with guard result, or "no confident match" |
| GET | `/posts/:id/check/:imageId` | Run the guard on any image for a post |
| GET | `/suggestions` | List suggestions, filter by review status or guard result |
| GET | `/suggestions/:id` | Inspect why an image was selected or refused |
| POST | `/suggestions/:id/approve` | Approve a suggestion |
| POST | `/suggestions/:id/reject` | Reject with an optional note |
| GET | `/costs` | Cost log totals and recent calls |

## How the mismatch guard decides

A candidate image is rejected when any of these fail, and every failure is listed in the response:

1. Image tag confidence is below `MIN_IMAGE_CONFIDENCE` (0.90).
2. Cosine similarity is below `MIN_SIMILARITY` (0.78).
3. The post subject is unknown, meaning no species name scored at least `SPECIES_MIN_SCORE` (0.80) against the post.
4. The image category or species differs from the post. Species within `SPECIES_AMBIGUITY_BAND` (0.025) of the best match are all accepted, so a deer post can show an elk image.

Example rejection: `Animal category mismatch: expected fox, detected wolf`.

## Evaluation results

The eval set is in `eval/`. Last run, reproduced after wiping the database and rebuilding it with `npm run seed`:

| Measure | Result |
| --------- | -------- |
| Top-1 precision, 16 labelled posts | 1.00 (16 of 16) |
| Held-out posts written before the last rule change | 5 of 5 |
| Synonym posts ("Vulpes vulpes", "Canis lupus", "Ursus arctos") | 3 of 3 |
| Posts with no suitable image return "no confident match" | 12 of 12 |
| Forced wrong images rejected (wolf on fox post, wolf on corgi post) | 2 of 2 |

Thresholds used: similarity 0.78, image confidence 0.90, species score 0.80, ambiguity band 0.025.

How much to trust these numbers: the eval set is small and was built by the author. The thresholds were tuned against it, and 9 of the 12 no-match posts had their scores looked at before the species threshold was chosen. Only 3 no-match posts (hippos, owls, dolphins) were blind, and all 3 passed. Early in development top-1 precision was 0.875 and two correct deer images were wrongly refused by an over strict species rule. A later change fixed that but let a giraffe post match a deer image, which the species score threshold then fixed. Both failures and fixes are recorded in `BUILDLOG.md`.

## Cost

Every vision and embedding call writes a row to `cost_log` and is visible at `GET /costs`. A daily budget guard (`DAILY_BUDGET_USD`) stops new calls when it is reached. Everything runs on the free tier, so real spend is zero, and the logged dollar figures are estimates at paid list prices. Embedding token counts are estimated from text length.

## Limitations

- **Free tier daily limit.** The Gemini free tier allowed only about 10 to 20 vision requests per model per day. The batch job stops cleanly with `quota_stopped` and leaves images `pending`. The corpus was tagged over several runs on different models, which is why `seed/image-tags.json` exists.
- **The model can be confidently wrong on bad input.** A deliberately pixelated fox image was tagged "white horse" with confidence 0.60. Images below 0.90 are flagged and never suggested.
- **Four images are synthetic.** `img_051.jpg` to `img_054.jpg` are degraded copies of other corpus images, made to show low confidence flagging. They are not real photographs and are not used as eval answers.
- **Generic posts may get no match.** Species detection compares the post with species names. A vague post such as "Training a puppy" scores below 0.80 and gets "no confident match" instead of a dog image. This errs on the safe side but loses recall.
- **One case sits on the threshold.** The penguin post scored 0.78 against the similarity threshold, so its rejection is fragile.
- **Small corpus.** 54 images, animals only, 5 main categories. Species detection only knows species present in the corpus.
- **Scale.** Vectors are stored as arrays and compared in application code. That is fine at this size and not for thousands of images, where pgvector would be the next step.
- **No frontend and no authentication.** The review workflow is API only.
- **Single tenant.** One shared image library and one set of posts. There is no tenant isolation.
- **Budget guard is untested in a live run.** The daily budget stop (`DAILY_BUDGET_USD`, outcome `budget_stopped`) is implemented in `src/logic/tagImage.js`, but only the quota stop and the retry path were exercised in test runs.

## Repository layout

```text
src/            application code (http, logic, data, ai, jobs, config)
migrations/     numbered SQL migrations
scripts/        migrate, seed, eval, probes, corpus tools
corpus/         the image library and its sources and licenses
eval/           labelled evaluation set and last run output
seed/           saved vision tags so the demo needs no vision quota
DESIGN.md       design document and implementation changes
BUILDLOG.md     where AI helped, where it was wrong, what changed
EVIDENCE.md     one proof per requirement
capstone.yaml   run, seed and test commands
```

## License

MIT
