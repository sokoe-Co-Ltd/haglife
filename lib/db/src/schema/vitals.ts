import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vitalsTable = pgTable("vitals", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  temperature: numeric("temperature", { precision: 4, scale: 1 }),
  bpSystolic: integer("bp_systolic"),
  bpDiastolic: integer("bp_diastolic"),
  pulse: integer("pulse"),
  spo2: integer("spo2"),
  needsRecheck: boolean("needs_recheck").notNull().default(false),
  isBath: boolean("is_bath").notNull().default(false),
  bathType: text("bath_type"),
  bathStaffId: integer("bath_staff_id"),
  bathMemo: text("bath_memo"),
  notes: text("notes"),
  measuredByStaffId: integer("measured_by_staff_id"),
  measuredByName: text("measured_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVitalSchema = createInsertSchema(vitalsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVital = z.infer<typeof insertVitalSchema>;
export type Vital = typeof vitalsTable.$inferSelect;
