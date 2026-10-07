# Design: AI Image Understanding & Content Matching Engine

## 1. Problem

A blog has a library of images and a set of posts. Filenames and keywords are not reliable, so picking the right image for a post is manual work. This service looks at each image, understands what is in it, tags it, and suggests the best image for each post based on meaning. When no image is a good enough match, it says so with a reason instead of guessing. A post about red foxes must get a red fox image, never a wolf.

## 2. Stack

- Runtime: Node.js with Express (JavaScript)
- Vision model: Gemini Flash free tier (structured JSON output)
- Embeddings: Gemini embeddings free tier (`SEMANTIC_SIMILARITY` task type)
- Validation: Zod
- Database: PostgreSQL in Docker, vectors stored as `double precision[]` (about 50 images, pgvector not needed)
- Background jobs: Inngest, retries and failure alert
- Corpus: about 50 Unsplash or Pexels images, 5 categories (fox, wolf, dog, deer, bear), committed with a download script

## 3. Image metadata schema

```json
{
  "subject": "red fox",
  "category": "animal",
  "species": "fox",
  "attributes": ["orange fur", "wild", "forest"],
  "caption": "A red fox standing in a forest",
  "confidence": 0.94
}
```

Rules enforced by Zod:

- `subject`, `species`, `caption` are non-empty strings
- `attributes` is an array of 1 to 8 strings
- `confidence` is a number between 0 and 1
- Any response that fails validation is retried up to 3 times, then the image is marked `failed` and never stored as tagged
- `confidence` below `LOW_CONFIDENCE` (0.60) marks the image `flagged` for review instead of accepting it

## 4. Matching strategy

1. Each image caption plus subject plus attributes is embedded once and stored in `image_vectors`.
2. Each post title plus body is embedded and stored in `post_vectors`.
3. For a post, cosine similarity is computed against every image vector and the results are ranked.
4. Each ranked candidate passes through the mismatch guard before it is shown.
5. The first candidate that passes the guard is the suggestion. If none pass, the answer is "no confident match" with reasons.

Matching is by concept, not by words, so "red fox", "Vulpes vulpes" and "wild fox species" land close together.

## 5. Mismatch guard

The guard is its own module with no HTTP or database code, so it can be unit tested alone. A candidate is rejected when any rule fails:

| Rule | Check | Example reason |
| ------ | ------- | ---------------- |
| Confidence | image `confidence` below `MIN_IMAGE_CONFIDENCE` | "Image tag confidence 0.41 is below 0.60" |
| Similarity | cosine score below `MIN_SIMILARITY` | "Similarity 0.52 is below threshold 0.70" |
| Category | post subject category differs from image category | "Category mismatch: expected animal, detected vehicle" |
| Species | post species differs from image species | "Animal category mismatch: expected fox, detected wolf" |

Post subject and species are extracted from the post text with the same Zod-validated model call used for images.

Thresholds start as placeholders and are set from the eval set, picked to maximise top-1 precision while keeping the fox versus wolf boundary clean. The final values and the precision number go in the README.

## 6. Database design

| Table | Key fields | Indexes |
| ------- | ----------- | --------- |
| `images` | id, file_path, content_hash, status (`pending`, `tagged`, `flagged`, `failed`), created_at | unique on `content_hash`, index on `status` |
| `image_metadata` | image_id, subject, category, species, attributes (text[]), caption, confidence | unique on `image_id`, index on `category`, index on `species` |
| `image_vectors` | image_id, embedding (double precision[]), model | unique on `image_id` |
| `posts` | id, title, body, subject, category, species | index on `category` |
| `post_vectors` | post_id, embedding (double precision[]), model | unique on `post_id` |
| `suggestions` | id, post_id, image_id, rank, score, guard_result (`passed`, `rejected`), reason, review_status (`pending`, `approved`, `rejected`), reviewed_at | unique on (`post_id`, `image_id`), index on `review_status` |
| `cost_log` | id, call_type (`vision`, `embedding`), model, image_id or post_id, input_tokens, output_tokens, cost_usd, created_at | index on `created_at`, index on `call_type` |
| `job_runs` | id, image_id, attempt, status, error, created_at | index on `image_id` |

Schema is managed by numbered SQL migrations. Reprocessing the same image is idempotent through the unique `content_hash` and the unique keys above, so a retried job never creates duplicate rows.

## 7. API surface

| Method | Path | Purpose |
| -------- | ------ | --------- |
| POST | `/images/ingest` | Register images from the corpus folder, returns 202 |
| POST | `/jobs/process-images` | Start the batch job, returns 202 with a job id |
| GET | `/jobs/:id` | Job progress (done, failed, flagged counts) |
| GET | `/images` | List images with status and tags |
| POST | `/posts` | Create a post and embed it |
| GET | `/posts/:id/images` | Ranked suggestions with guard result and reasons, or "no confident match" |
| POST | `/suggestions/:id/approve` | Human approves a suggestion |
| POST | `/suggestions/:id/reject` | Human rejects a suggestion with a reason |
| GET | `/suggestions/:id` | Inspect why an image was selected or refused |
| GET | `/costs` | Cost log with totals per call type |

Bad input returns a clean 4xx with a JSON error, never a 500.

## 8. Layers

```text
src/
  http/        routes, request validation, error mapping
  logic/       matching, ranking, mismatch guard, thresholds
  data/        repositories, migrations, queries
  ai/          vision client, embedding client, Zod schemas
  jobs/        background batch job, retry policy
  config/      env loading, budget settings
scripts/       corpus download, seed, eval, probes
eval/          labeled eval set
```

HTTP code never touches SQL. Logic code never calls the network directly. The guard has no imports from `http` or `data`.

## 9. Batch jobs and cost control

- Vision and embedding calls run only inside the background job, never on the request path
- Each image is retried up to 3 times with backoff, then marked `failed` and a failure alert is logged
- Every vision and embedding call writes one row to `cost_log`
- A daily budget guard stops new calls when `DAILY_BUDGET_USD` is reached
- API keys live only in `.env`, never in code, logs or commits, and `.env.example` ships with placeholders

## 10. Evaluation plan

- A labeled set of 12 or more posts, each mapped to its one correct image
- The eval script runs every post through the full pipeline and prints top-1 precision
- That number is copied into the README
- At least one eval case is a post with no suitable image, expected result "no confident match"
- At least one eval case forces the wolf as a candidate for a fox post, expected result rejected

## 11. Explicit non-goal

No frontend. The review workflow is API endpoints only.

## 12. Changes made during implementation

- Post subject detection uses embeddings instead of a vision model call. Each known species name is embedded once and compared with the post embedding. A species is accepted only when its score is at least `SPECIES_MIN_SCORE` and it leads the second best by at least `SPECIES_MIN_MARGIN`. This avoids spending the free tier's small daily request quota on posts. Measured on sample posts, relevant posts scored 0.78 to 0.87 with margins of 0.03 or more, and unrelated posts scored 0.72 to 0.74 with margins near 0.002.
- When no species is detected, the guard rejects every candidate with the reason "No known subject detected in the post".
- The vision model is `gemini-3.8-flash`. The free tier allows 20 requests per model per day, so the batch job stops early with `quota_stopped` on a daily quota error and leaves the remaining images `pending` so they can be resumed later.
- Review API additions: a guard-rejected suggestion cannot be approved, and a reviewed suggestion cannot change its decision.
- Cost is recorded per call in `cost_log`, and embedding token counts are estimated from text length.
- `LOW_CONFIDENCE` and `MIN_IMAGE_CONFIDENCE` are both 0.90. All 50 real photographs in the corpus were tagged with confidence of 0.95 or higher. Four deliberately degraded images (img_051 to img_054) were tagged with confidence from 0.60 to 0.95, and one of them (a pixelated fox) was labelled "white horse" at 0.60, so the model can be confidently wrong on bad input. Images below 0.90 are flagged for human review and the guard rejects them as candidates.
