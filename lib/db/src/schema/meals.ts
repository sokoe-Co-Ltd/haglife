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

export const mealsTable = pgTable("meals", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  mealType: text("meal_type").notNull(),
  mealLocation: text("meal_location"),
  mainDishPercent: integer("main_dish_percent"),
  sideDishPercent: integer("side_dish_percent"),
  waterMl: integer("water_ml"),
  nutritionSupplementPercent: integer("nutrition_supplement_percent"),
  waterOnly: boolean("water_only").notNull().default(false),
  medicationOk: boolean("medication_ok").notNull().default(false),
  medicationByStaffId: integer("medication_by_staff_id"),
  medicationByName: text("medication_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMealSchema = createInsertSchema(mealsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof mealsTable.$inferSelect;
