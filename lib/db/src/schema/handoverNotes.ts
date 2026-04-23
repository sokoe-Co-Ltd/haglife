import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const handoverNotesTable = pgTable("handover_notes", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  category: text("category").notNull().default("その他"),
  isImportant: boolean("is_important").notNull().default(false),
  isDoctorReport: boolean("is_doctor_report").notNull().default(false),
  status: text("status").notNull().default("未対応"),
  content: text("content").notNull(),
  authorId: integer("author_id"),
  photo1Url: text("photo1_url"),
  photo2Url: text("photo2_url"),
  photo3Url: text("photo3_url"),
  photo4Url: text("photo4_url"),
  photo5Url: text("photo5_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertHandoverNoteSchema = createInsertSchema(
  handoverNotesTable,
).omit({ id: true, createdAt: true });
export type InsertHandoverNote = z.infer<typeof insertHandoverNoteSchema>;
export type HandoverNote = typeof handoverNotesTable.$inferSelect;
