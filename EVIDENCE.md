# EVIDENCE

One proof per requirement from section 6 of the capstone brief. Every output below was produced by running `node scripts/evidence.js` against the running system at commit `d362ced` on 2026-10-07T07:45:39.197Z.

## Acceptance probes

```
PROBE 1 PASS | images 54 | tagged 52 | flagged 2 | pending 0 | schema-invalid 0
PROBE 2 PASS | top corpus/img_031.jpg (fox), non fox candidates in top 5: 0, all rejected: true
PROBE 3 PASS | rejected | Similarity 0.76 is below threshold 0.78; Animal category mismatch: expected fox, detected wolf
PROBE 4 PASS | no confident match | Similarity 0.73 is below threshold 0.78; No known subject detected in the post, so no image subject can be matched
PROBE 6 PASS | calls 139 | unattributed 0 | total usd 0.004461
PROBE 5 | top1 1 (16/16) held-out 1 (5/5) synonym 3/3 no-match 12/12 forced 2/2
```

## 1. Structured output validated against a schema

Requirement: Vision model produces structured output validated against a schema; invalid responses are never trusted.

Schema check on invalid and valid model outputs:

```
confidence above 1: rejected | confidence: Too big: expected number to be <=1
missing species: rejected | species: Invalid input: expected string, received undefined
empty attributes: rejected | attributes: Too small: expected array to have >=1 items
wrong type for confidence: rejected | confidence: Invalid input: expected number, received string
valid sample: accepted
```

Where it is enforced:

```
src/ai/visionClient.js:26: responseMimeType: "application/json",
src/ai/visionClient.js:42: const parsed = visionSchema.safeParse(raw);
src/logic/tagImage.js:5: import { getImage, insertJobRun, saveTags, markStatus } from "../data/tagRepo.js";
src/logic/tagImage.js:65: if (!result.ok) {
src/logic/tagImage.js:67: await insertJobRun({ imageId, attempt, status: "invalid", error: lastError });
src/logic/tagImage.js:78: await markStatus(imageId, "failed");
```

## 2. Low confidence classifications are flagged

Requirement: Low-confidence classifications are flagged instead of accepted.

LOW_CONFIDENCE is 0.90. Images below it:

```
file | status | species | confidence
img_051.jpg | flagged | mountain goat | 0.6
img_053.jpg | flagged | dog | 0.8
```

Status counts:

```
status | images
flagged | 2
tagged | 52
```

## 3. Batch background job with retries

Requirement: Images are processed through a batch background job with retries.

Job runs by status (error rows are retries, ok rows are successes):

```
status | runs
error | 3
ok | 3
```

Most recent runs:

```
image_id | attempt | status | error
2 | 3 | error | {"error":{"code":404,"message":"models/bogus-model is not found for API version 
2 | 2 | error | {"error":{"code":404,"message":"models/bogus-model is not found for API version 
2 | 1 | error | {"error":{"code":404,"message":"models/bogus-model is not found for API version 
51 | 1 | ok | 
31 | 1 | ok | 
1 | 1 | ok | 
```

Job and retry definitions:

```
src/jobs/processImages.js:7: export const processImages = inngest.createFunction(
src/jobs/processImages.js:10: concurrency: 1,
src/jobs/processImages.js:11: retries: 2,
src/jobs/processImages.js:12: onFailure: async ({ error }) => {
src/jobs/processImages.js:13: console.error(`ALERT process-images failed: ${error.message}`);
src/jobs/processImages.js:28: console.error(`ALERT process-images stopped early: ${result.outcome}`);
src/logic/tagImage.js:10: const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
src/logic/tagImage.js:36: for (let attempt = 1; attempt <= env.MAX_ATTEMPTS; attempt++) {
src/logic/tagImage.js:48: await insertJobRun({ imageId, attempt, status: "quota_stopped", error: "daily model quota reached" });
src/logic/tagImage.js:49: return { imageId, outcome: "quota_stopped" };
src/logic/tagImage.js:52: await sleep((isTransient(lastError) ? 8000 : 1000) * 2 ** (attempt - 1));
src/logic/tagImage.js:74: await sleep(env.INTER_CALL_DELAY_MS);
src/logic/tagImage.js:79: console.error(`ALERT image ${imageId} failed after ${env.MAX_ATTEMPTS} attempts: ${lastError}`);
```

## 4. Costs tracked per call

Requirement: Vision and embedding costs are tracked per call.

GET /costs?limit=3:

```
{
  "totals": {
    "calls": 139,
    "totalUsd": 0.004461,
    "unattributed": 0
  },
  "byType": [
    {
      "call_type": "embedding",
      "model": "gemini-embedding-001",
      "calls": 136,
      "input_tokens": 3725,
      "output_tokens": 0,
      "total_usd": 0.000575,
      "unattributed": 0
    },
    {
      "call_type": "vision",
      "model": "gemini-3.1-flash-lite-preview",
      "calls": 3,
      "input_tokens": 3731,
      "output_tokens": 290,
      "total_usd": 0.003886,
      "unattributed": 0
    }
  ],
  "recent": [
    {
      "id": 139,
      "call_type": "embedding",
      "model": "gemini-embedding-001",
      "image_id": null,
      "post_id": 43,
      "label": null,
      "input_tokens": 22,
      "output_tokens": 0,
      "cost_usd": 0.000003,
      "created_at": "2026-10-07T07:45:40.764Z"
    },
    {
      "id": 138,
      "call_type": "embedding",
      "model": "gemini-embedding-001",
      "image_id": null,
      "post_id": 42,
      "label": null,
      "input_tokens": 23,
      "output_tokens": 0,
      "cost_usd": 0.000003,
      "created_at": "2026-10-07T07:45:40.046Z"
    },
    {
      "id": 137,
      "call_type": "embedding",
      "model": "gemini-embedding-001",
      "image_id": null,
      "post_id": 41,
      "label": null,
      "input_tokens": 23,
      "output_tokens": 0,
      "cost_usd": 0.000003,
      "created_at": "2026-10-07T07:45:39.053Z"
    }
  ]
}
```

Every call row carries an image, a post or a label (unattributed must be 0):

```
call_type | calls | unattributed
embedding | 136 | 0
vision | 3 | 0
```

## 5. Embeddings stored and ranked suggestions returned

Requirement: Image and post embeddings are stored; posts return ranked image suggestions.

```
stored | rows | dims
image_vectors | 54 | 3072
post_vectors | 43 | 3072
```

GET /posts/:id/images for the red fox article:

```
{
  "status": 200,
  "postId": 39,
  "detected": {
    "species": "fox",
    "accepted": [
      "fox"
    ],
    "score": 0.8613,
    "margin": 0.0541,
    "bestGuess": "fox"
  },
  "message": "suggestion found",
  "reasons": [],
  "candidates": [
    {
      "rank": 1,
      "file": "corpus/img_031.jpg",
      "species": "fox",
      "score": 0.844,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 2,
      "file": "corpus/img_046.jpg",
      "species": "fox",
      "score": 0.8408,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 3,
      "file": "corpus/img_025.jpg",
      "species": "fox",
      "score": 0.8336,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 4,
      "file": "corpus/img_003.jpg",
      "species": "fox",
      "score": 0.8303,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 5,
      "file": "corpus/img_019.jpg",
      "species": "fox",
      "score": 0.827,
      "guard": "passed",
      "reasons": []
    }
  ]
}
```

## 6. Semantic matching of equivalent concepts

Requirement: Semantic matching works for equivalent concepts, so "red fox" matches "Vulpes vulpes".

A post that only says Vulpes vulpes and wild fox species:

```
{
  "status": 200,
  "postId": 40,
  "detected": {
    "species": "fox",
    "accepted": [
      "fox"
    ],
    "score": 0.8797,
    "margin": 0.0563,
    "bestGuess": "fox"
  },
  "message": "suggestion found",
  "reasons": [],
  "candidates": [
    {
      "rank": 1,
      "file": "corpus/img_046.jpg",
      "species": "fox",
      "score": 0.8599,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 2,
      "file": "corpus/img_025.jpg",
      "species": "fox",
      "score": 0.8561,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 3,
      "file": "corpus/img_029.jpg",
      "species": "fox",
      "score": 0.8517,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 4,
      "file": "corpus/img_019.jpg",
      "species": "fox",
      "score": 0.8498,
      "guard": "passed",
      "reasons": []
    },
    {
      "rank": 5,
      "file": "corpus/img_003.jpg",
      "species": "fox",
      "score": 0.8494,
      "guard": "passed",
      "reasons": []
    }
  ]
}
```

## 7. The guard rejects the wolf on a fox post

Requirement: The mismatch guard rejects incorrect recommendations; the wolf-on-a-fox-post scenario provably fails.

Forcing corpus/img_005.jpg as a candidate for the red fox post:

```
{
  "postId": 39,
  "imageId": 5,
  "postSpecies": "fox",
  "imageSpecies": "wolf",
  "score": 0.7669,
  "result": "rejected",
  "reasons": [
    "Similarity 0.77 is below threshold 0.78",
    "Animal category mismatch: expected fox, detected wolf"
  ]
}
```

Second forced case from the eval run:

```
[
  {
    "kind": "forced",
    "postTitle": "A sleeping fox",
    "image": "img_005.jpg",
    "result": "rejected",
    "reasons": [
      "Animal category mismatch: expected fox, detected wolf"
    ],
    "ok": true
  },
  {
    "kind": "forced",
    "postTitle": "Training a corgi",
    "image": "img_016.jpg",
    "result": "rejected",
    "reasons": [
      "Similarity 0.77 is below threshold 0.78",
      "Animal category mismatch: expected dog, detected wolf"
    ],
    "ok": true
  }
]
```

## 8. Rejections explain themselves

Requirement: Rejections include a human-readable explanation.

Every rejection above carries a reasons list. Persisted rejections in the suggestions table:

```
post_id | image_id | rank | guard_result | reason
43 | 8 | 5 | rejected | Similarity 0.72 is below threshold 0.78; No known subject detected in the post, so no image subject can be mat
43 | 36 | 4 | rejected | Similarity 0.73 is below threshold 0.78; No known subject detected in the post, so no image subject can be mat
43 | 2 | 3 | rejected | Similarity 0.73 is below threshold 0.78; No known subject detected in the post, so no image subject can be mat
43 | 20 | 2 | rejected | Similarity 0.73 is below threshold 0.78; No known subject detected in the post, so no image subject can be mat
43 | 39 | 1 | rejected | Similarity 0.73 is below threshold 0.78; No known subject detected in the post, so no image subject can be mat
41 | 46 | 5 | rejected | Similarity 0.73 is below threshold 0.78; No known subject detected in the post, so no image subject can be mat
```

## 9. No confident match with reasons

Requirement: When no image clears the bar, the system answers "no confident match" with reasons.

A laptop post against an animal image library:

```
{
  "status": 200,
  "postId": 41,
  "detected": {
    "species": null,
    "accepted": [],
    "score": 0.7466,
    "margin": 0.0119,
    "bestGuess": "guanaco"
  },
  "message": "no confident match",
  "reasons": [
    "Similarity 0.73 is below threshold 0.78",
    "No known subject detected in the post, so no image subject can be matched"
  ],
  "candidates": [
    {
      "rank": 1,
      "file": "corpus/img_039.jpg",
      "species": "deer",
      "score": 0.7338,
      "guard": "rejected",
      "reasons": [
        "Similarity 0.73 is below threshold 0.78",
        "No known subject detected in the post, so no image subject can be matched"
      ]
    },
    {
      "rank": 2,
      "file": "corpus/img_002.jpg",
      "species": "deer",
      "score": 0.7293,
      "guard": "rejected",
      "reasons": [
        "Similarity 0.73 is below threshold 0.78",
        "No known subject detected in the post, so no image subject can be matched"
      ]
    },
    {
      "rank": 3,
      "file": "corpus/img_036.jpg",
      "species": "guanaco",
      "score": 0.7281,
      "guard": "rejected",
      "reasons": [
        "Similarity 0.73 is below threshold 0.78",
        "No known subject detected in the post, so no image subject can be matched"
      ]
    },
    {
      "rank": 4,
      "file": "corpus/img_020.jpg",
      "species": "dog",
      "score": 0.7266,
      "guard": "rejected",
      "reasons": [
        "Similarity 0.73 is below threshold 0.78",
        "No known subject detected in the post, so no image subject can be matched"
      ]
    },
    {
      "rank": 5,
      "file": "corpus/img_046.jpg",
      "species": "fox",
      "score": 0.7255,
      "guard": "rejected",
      "reasons": [
        "Similarity 0.73 is below threshold 0.78",
        "No known subject detected in the post, so no image subject can be matched"
      ]
    }
  ]
}
```

## 10. Database models and indexes

Requirement: Database models for images, tags, embeddings, posts, suggestions, approvals and rejections, with the required indexes.

Tables:

```
cost_log
image_metadata
image_vectors
images
job_runs
post_vectors
posts
schema_migrations
suggestions
```

Indexes:

```
tablename | indexname
cost_log | cost_log_call_type_idx
cost_log | cost_log_created_at_idx
cost_log | cost_log_pkey
image_metadata | image_metadata_category_idx
image_metadata | image_metadata_pkey
image_metadata | image_metadata_species_idx
image_vectors | image_vectors_pkey
images | images_content_hash_key
images | images_pkey
images | images_status_idx
job_runs | job_runs_image_id_idx
job_runs | job_runs_pkey
post_vectors | post_vectors_pkey
posts | posts_category_idx
posts | posts_pkey
schema_migrations | schema_migrations_pkey
suggestions | suggestions_pkey
suggestions | suggestions_post_id_image_id_key
suggestions | suggestions_review_status_idx
```

Migrations applied:

```
name
001_init.sql
002_review_note.sql
003_cost_label.sql
```

## 11. Validated endpoints and review workflow

Requirement: API endpoints are validated; the review workflow (approve / reject / inspect why) exists.

Validation and review workflow transcript:

```
invalid body: POST /posts -> 400 "invalid_body"
invalid query: GET /images?status=bogus -> 400 "invalid_query"
invalid query: GET /costs?limit=0 -> 400 "invalid_query"
unknown id: GET /suggestions/99999 -> 404 "suggestion_not_found"
approve: POST /suggestions/371/approve -> 200 "approved"
approve again: POST /suggestions/371/approve -> 200 "approved"
reject after approve: POST /suggestions/371/reject -> 409 "already_reviewed"
reject with note: POST /suggestions/372/reject -> 200 "rejected"
approve guard rejected: POST /suggestions/381/approve -> 409 "cannot_approve_guard_rejected"
```

Inspect why an image was selected (GET /suggestions/:id):

```
{
  "id": 372,
  "post_id": 39,
  "image_id": 46,
  "rank": 2,
  "score": 0.840818286008162,
  "guard_result": "passed",
  "reason": null,
  "review_status": "rejected",
  "review_note": "Not the best crop for the article",
  "reviewed_at": "2026-10-07T07:45:40.978Z",
  "post_title": "Evidence: the red fox article",
  "post_species": "fox",
  "file_path": "corpus/img_046.jpg",
  "image_subject": "red fox",
  "image_species": "fox",
  "image_caption": "A red fox rests on a grey surface in front of green foliage.",
  "image_confidence": 1
}
```

## 12. Eval set and top-1 precision

Requirement: A small labelled evaluation dataset measures top-1 precision; the number is in the README.

eval/last-run.json summary:

```
{
  "top1Precision": 1,
  "top1Correct": 16,
  "top1Total": 16,
  "heldOutPrecision": 1,
  "heldOutCorrect": 5,
  "heldOutTotal": 5,
  "synonymCorrect": "3/3",
  "noMatchCorrect": "12/12",
  "forcedRejected": "2/2",
  "thresholds": {
    "minSimilarity": 0.78,
    "minImageConfidence": 0.9,
    "speciesMinScore": 0.8,
    "speciesAmbiguityBand": 0.025
  }
}
```

Matching lines in README.md:

```
| 5 | The eval script runs and reports top-1 precision, matching the number below |
| Top-1 precision, 16 labelled posts | 1.00 (16 of 16) |
How much to trust these numbers: the eval set is small and was built by the author. The thresholds were tuned against it, and 9 of the 12 no-match posts had their scores looked at before the species threshold was chosen. Only 3 no-match posts (hippos, owls, dolphins) were blind, and all 3 passed. Early in development top-1 precision was 0.875 and two correct deer images were wrongly refused by an over strict species rule. A later change fixed that but let a giraffe post match a deer image, which the species score threshold then fixed. Both failures and fixes are recorded in `BUILDLOG.md`.
```

Labelled cases per group:

```
top1: 16
held-out: 5
synonym: 3
no_match: 12
forced: 2
```

## 13. README and required files

Requirement: README with architecture explanation and diagram; the required files from section 11 are present.

Required files (EVIDENCE.md is this file and exists after the script writes it):

```
README.md: present
capstone.yaml: present
EVIDENCE.md: present
BUILDLOG.md: present
.env.example: present
DESIGN.md: present
LICENSE: present
```

capstone.yaml:

```
run: npm run up
seed: npm run seed
test: npm test
base_url: http://localhost:3000

```

README has an architecture section and diagram:

```
## Architecture
Vision model --> {subject, category, species, attributes, caption, confidence}
posts --> embed(title + body) --> post_vectors
    -> cosine similarity ranking (image_vectors x post_vector)
        -> mismatch guard (confidence, similarity, category, species)
            -> suggested image, or "no confident match" with reasons
```

Secrets are not committed (.env is ignored and not tracked):

```
git check-ignore -v .env
.gitignore:69:.env	.env
git ls-files .env
(not tracked)
```
