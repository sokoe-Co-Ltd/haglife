ALTER TABLE day_services
  ADD COLUMN IF NOT EXISTS pickup_time text,
  ADD COLUMN IF NOT EXISTS return_time text;
