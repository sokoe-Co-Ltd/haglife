ALTER TABLE "shift_types"
ADD COLUMN IF NOT EXISTS "required_staff_count" integer NOT NULL DEFAULT 0;