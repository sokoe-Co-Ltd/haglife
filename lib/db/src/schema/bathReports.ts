import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bathReportsTable = pgTable("bath_reports", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  staffId: integer("staff_id"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  temperature: numeric("temperature", { precision: 4, scale: 1 }),
  bpSystolic: integer("bp_systolic"),
  bpDiastolic: integer("bp_diastolic"),
  pulse: integer("pulse"),
  spo2: integer("spo2"),
  bathMemo: text("bath_memo"),
  handoverNotes: text("handover_notes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertBathReportSchema = createInsertSchema(bathReportsTable).omit(
  { id: true, createdAt: true },
);
export type InsertBathReport = z.infer<typeof insertBathReportSchema>;
export type BathReport = typeof bathReportsTable.$inferSelect;
