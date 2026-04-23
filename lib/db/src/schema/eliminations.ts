import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eliminationsTable = pgTable("eliminations", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  type: text("type").notNull(),
  amount: text("amount"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eliminationRoundChecksTable = pgTable(
  "elimination_round_checks",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id").notNull(),
    staffId: integer("staff_id"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    roundResetAt: timestamp("round_reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
);

export const eliminationRoundStateTable = pgTable(
  "elimination_round_state",
  {
    id: serial("id").primaryKey(),
    lastResetAt: timestamp("last_reset_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertEliminationSchema = createInsertSchema(
  eliminationsTable,
).omit({ id: true, createdAt: true });
export type InsertElimination = z.infer<typeof insertEliminationSchema>;
export type Elimination = typeof eliminationsTable.$inferSelect;
