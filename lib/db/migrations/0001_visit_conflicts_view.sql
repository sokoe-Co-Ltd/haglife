CREATE OR REPLACE VIEW visit_conflicts AS
WITH cells_with_staff AS (
  SELECT
    c.id              AS cell_id,
    c.route_sheet_row_id,
    r.route_sheet_id,
    r.staff_id,
    -- staff_id があればそれ、無ければ staff_name でグルーピング (移行期間の安全策)
    COALESCE(r.staff_id::text, 'name:' || COALESCE(r.staff_name, '')) AS staff_key,
    c.start_time::time AS start_t,
    c.end_time::time   AS end_t
  FROM route_sheet_cells c
  JOIN route_sheet_rows r ON c.route_sheet_row_id = r.id
  WHERE c.is_break = false
    AND c.start_time ~ '^[0-2][0-9]:[0-5][0-9]$'
    AND c.end_time   ~ '^[0-2][0-9]:[0-5][0-9]$'
)
SELECT
  a.cell_id        AS cell_a_id,
  b.cell_id        AS cell_b_id,
  a.route_sheet_id,
  a.staff_id,
  a.staff_key,
  a.start_t::text  AS a_start,
  a.end_t::text    AS a_end,
  b.start_t::text  AS b_start,
  b.end_t::text    AS b_end
FROM cells_with_staff a
JOIN cells_with_staff b
  ON a.staff_key       = b.staff_key
  AND a.route_sheet_id = b.route_sheet_id
  AND a.cell_id        < b.cell_id
WHERE (a.start_t, a.end_t) OVERLAPS (b.start_t, b.end_t);

CREATE INDEX IF NOT EXISTS idx_route_sheet_rows_staff_id
  ON route_sheet_rows(staff_id);

CREATE INDEX IF NOT EXISTS idx_route_sheet_rows_route_sheet_id
  ON route_sheet_rows(route_sheet_id);
