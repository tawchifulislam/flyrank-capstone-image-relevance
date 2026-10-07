ALTER TABLE cost_log ADD COLUMN label TEXT;
UPDATE cost_log SET label = 'species_label' WHERE image_id IS NULL AND post_id IS NULL;
