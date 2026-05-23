import { pgTable, uuid, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const routeSheetCellAuditLogTable = pgTable(
  "route_sheet_cell_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cellId: integer("cell_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    actorStaffId: integer("actor_staff_id"),
    action: text("action").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    reason: text("reason"),
  },
  (t) => [
    index("rs_cell_audit_cell_idx").on(t.cellId, t.occurredAt),
    index("rs_cell_audit_occurred_idx").on(t.occurredAt),
  ]
);

export type RouteSheetCellAuditLog =
  typeof routeSheetCellAuditLogTable.$inferSelect;
export type NewRouteSheetCellAuditLog =
  typeof routeSheetCellAuditLogTable.$inferInsert;

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "skip",
  "unskip",
  "add_adhoc",
  "reassign",
  "clear_note",
  "accept_notification",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
