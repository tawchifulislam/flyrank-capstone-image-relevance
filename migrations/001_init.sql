CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'tagged', 'flagged', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX images_status_idx ON images (status);

CREATE TABLE image_metadata (
  image_id INTEGER PRIMARY KEY REFERENCES images (id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  species TEXT NOT NULL,
  attributes TEXT[] NOT NULL,
  caption TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);
CREATE INDEX image_metadata_category_idx ON image_metadata (category);
CREATE INDEX image_metadata_species_idx ON image_metadata (species);

CREATE TABLE image_vectors (
  image_id INTEGER PRIMARY KEY REFERENCES images (id) ON DELETE CASCADE,
  embedding DOUBLE PRECISION[] NOT NULL,
  model TEXT NOT NULL
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  subject TEXT,
  category TEXT,
  species TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_category_idx ON posts (category);

CREATE TABLE post_vectors (
  post_id INTEGER PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  embedding DOUBLE PRECISION[] NOT NULL,
  model TEXT NOT NULL
);

CREATE TABLE suggestions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images (id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  guard_result TEXT NOT NULL CHECK (guard_result IN ('passed', 'rejected')),
  reason TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, image_id)
);
CREATE INDEX suggestions_review_status_idx ON suggestions (review_status);

CREATE TABLE cost_log (
  id SERIAL PRIMARY KEY,
  call_type TEXT NOT NULL CHECK (call_type IN ('vision', 'embedding')),
  model TEXT NOT NULL,
  image_id INTEGER REFERENCES images (id) ON DELETE SET NULL,
  post_id INTEGER REFERENCES posts (id) ON DELETE SET NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cost_log_created_at_idx ON cost_log (created_at);
CREATE INDEX cost_log_call_type_idx ON cost_log (call_type);

CREATE TABLE job_runs (
  id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES images (id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX job_runs_image_id_idx ON job_runs (image_id);
