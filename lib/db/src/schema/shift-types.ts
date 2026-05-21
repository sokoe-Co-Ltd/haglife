import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const shiftTypesTable = pgTable("shift_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  defaultStartTime: text("default_start_time"),
  defaultEndTime: text("default_end_time"),
  sortOrder: integer("sort_order").default(0).notNull(),
  color: text("color"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ShiftType = typeof shiftTypesTable.$inferSelect;
export type NewShiftType = typeof shiftTypesTable.$inferInsert;
