import { pgTable, uuid, text, integer, smallint, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const routeSheetTemplatesTable = pgTable("route_sheet_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekday: smallint("weekday").notNull().unique(),
  notes: text("notes"),
  lockedAt: timestamp("locked_at"),
  lockedBy: integer("locked_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const routeSheetTemplateRowsTable = pgTable("route_sheet_template_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").notNull(),
  shiftTypeId: uuid("shift_type_id").notNull(),
  slotLabel: text("slot_label").default("").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  defaultStaffId: integer("default_staff_id"),
});

export const routeSheetTemplateCellsTable = pgTable("route_sheet_template_cells", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateRowId: uuid("template_row_id").notNull(),
  residentServiceId: uuid("resident_service_id"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isBreak: boolean("is_break").default(false).notNull(),
  notes: text("notes"),
});

export type RouteSheetTemplate = typeof routeSheetTemplatesTable.$inferSelect;
export type RouteSheetTemplateRow = typeof routeSheetTemplateRowsTable.$inferSelect;
export type RouteSheetTemplateCell = typeof routeSheetTemplateCellsTable.$inferSelect;

// Suppress unused import warning while keeping index helper available for future use
void index;
