import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const shiftsTable = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: integer("staff_id").notNull(),
    date: text("date").notNull(),
    shiftTypeId: uuid("shift_type_id").notNull(),
    slotLabel: text("slot_label").default("").notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.date, t.shiftTypeId, t.slotLabel, t.staffId)]
);

export type Shift = typeof shiftsTable.$inferSelect;
export type NewShift = typeof shiftsTable.$inferInsert;
