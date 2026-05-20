import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const routeSheetsTable = pgTable("route_sheets", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  headerNote: text("header_note"),
  dayServiceNote: text("day_service_note"),
  specialNote: text("special_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const routeSheetRowsTable = pgTable("route_sheet_rows", {
  id: serial("id").primaryKey(),
  routeSheetId: integer("route_sheet_id").notNull(),
  staffName: text("staff_name").notNull(),
  shiftType: text("shift_type").notNull().default("日"),
  sortOrder: integer("sort_order").notNull().default(0),
  staffId: integer("staff_id"),
});

export const routeSheetCellsTable = pgTable("route_sheet_cells", {
  id: serial("id").primaryKey(),
  routeSheetRowId: integer("route_sheet_row_id").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isBreak: boolean("is_break").notNull().default(false),
  residentName: text("resident_name"),
  serviceLabel: text("service_label"),
  notes: text("notes"),
  residentId: integer("resident_id"),
  serviceTypeId: text("service_type_id"),
});

export type RouteSheet = typeof routeSheetsTable.$inferSelect;
export type RouteSheetRow = typeof routeSheetRowsTable.$inferSelect;
export type RouteSheetCell = typeof routeSheetCellsTable.$inferSelect;
