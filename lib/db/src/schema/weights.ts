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

export const weightsTable = pgTable("weights", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertWeightSchema = createInsertSchema(weightsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWeight = z.infer<typeof insertWeightSchema>;
export type Weight = typeof weightsTable.$inferSelect;
