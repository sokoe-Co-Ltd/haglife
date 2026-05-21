CREATE OR REPLACE VIEW active_resident_services AS
SELECT rs.*
FROM resident_services rs
JOIN residents r ON r.id = rs.resident_id
WHERE r.moved_out_at IS NULL
  AND r.hospitalized_at IS NULL
  AND rs.terminated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resident_services_resident
  ON resident_services(resident_id)
  WHERE terminated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resident_services_service_type
  ON resident_services(service_type_id);
