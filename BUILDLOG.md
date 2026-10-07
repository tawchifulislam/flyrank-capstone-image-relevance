# BUILDLOG

AI assistant used: Claude, for planning, code drafts and debugging. Every endpoint was run against the live system and checked with curl or SQL before moving on.

## Where AI helped

- Wrote the one-page design document and the phase plan from the capstone brief.
- Drafted the migration, the Express layers, the Zod schema, the Gemini vision and embedding clients, the Inngest batch job, the ranking logic, the mismatch guard and the review API.
- Suggested using neutral image file names and converting AVIF images to JPEG, since the vision API does not accept AVIF.

## Where AI was wrong or needed correction

- It used `gemini-2.5-flash` as the vision model. The API returned a 404 saying the model is no longer available to new users, so the model was changed to `gemini-3.8-flash` after checking current Google documentation.
- It set `thinkingBudget: 0`, which belongs to the older model family. That option was removed and thinking tokens are now counted as output tokens in the cost estimate.
- Its first batch job retried quickly and treated every failure the same. The first full run marked 42 of 50 images failed because of the free tier limit of 20 requests per model per day (429 errors) and temporary 503 errors. The job was changed to stop early on a daily quota error, leave images pending, back off longer on 503 and 429, and pause between calls.
- The planned vision-based post subject extraction would have used too much of the daily quota, so post subjects are detected with embeddings instead (see DESIGN.md section 12).
- The first `MIN_SIMILARITY` of 0.70 never rejected anything, because even an unrelated post scored about 0.72 against the closest image. The value was raised after looking at real scores and will be set finally from the eval set.

## What I changed myself

- Chose the corpus images and categories, and kept the file names neutral.
- Ran every test and probe, switched models when a daily quota ran out, and re-ran the batch job over several days.
- Decided the species and margin thresholds after reading the measured scores.

## Lessons

- A guard that only checks similarity is not enough. A wolf scored 0.77 against a fox post, close to genuine matches, and only the species rule caught it.
- Free tier quotas shape the design: batch work must be resumable and must stop cleanly.
