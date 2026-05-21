CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_type ON shifts(shift_type_id);
