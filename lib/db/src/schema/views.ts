import { pgView, integer, text } from "drizzle-orm/pg-core";

export const visitConflictsView = pgView("visit_conflicts", {
  cellAId: integer("cell_a_id").notNull(),
  cellBId: integer("cell_b_id").notNull(),
  routeSheetId: integer("route_sheet_id").notNull(),
  staffId: integer("staff_id"),
  staffKey: text("staff_key").notNull(),
  aStart: text("a_start").notNull(),
  aEnd: text("a_end").notNull(),
  bStart: text("b_start").notNull(),
  bEnd: text("b_end").notNull(),
}).existing();

export type VisitConflict = typeof visitConflictsView.$inferSelect;
