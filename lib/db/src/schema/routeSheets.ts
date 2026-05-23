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
  materializedFromTemplateId: text("materialized_from_template_id"),
  materializedAt: timestamp("materialized_at"),
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

  // === 計画スナップショット（materialize 時に固定） ===
  plannedStaffId: integer("planned_staff_id"),
  plannedStartTime: text("planned_start_time"),
  plannedEndTime: text("planned_end_time"),
  plannedServiceTypeId: text("planned_service_type_id"),

  // === 実態（操作画面からの書き込み） ===
  status: text("status").notNull().default("planned"),
  skipReason: text("skip_reason"),
  actualStaffId: integer("actual_staff_id"),
  staffReassigned: boolean("staff_reassigned").notNull().default(false),
  modifiedAt: timestamp("modified_at"),
  modifiedBy: integer("modified_by"),
  modifiedNote: text("modified_note"),
  isAdHoc: boolean("is_ad_hoc").notNull().default(false),
});

export type RouteSheet = typeof routeSheetsTable.$inferSelect;
export type RouteSheetRow = typeof routeSheetRowsTable.$inferSelect;
export type RouteSheetCell = typeof routeSheetCellsTable.$inferSelect;
