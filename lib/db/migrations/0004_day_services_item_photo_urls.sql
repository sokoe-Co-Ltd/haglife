ALTER TABLE day_services
  ADD COLUMN IF NOT EXISTS item_photo_urls text[] NOT NULL DEFAULT '{}';
