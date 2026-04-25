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

export const residentsTable = pgTable("residents", {
  id: serial("id").primaryKey(),
  roomNumber: text("room_number").notNull(),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  lastNameKana: text("last_name_kana").notNull(),
  firstNameKana: text("first_name_kana").notNull(),
  lastNameRoman: text("last_name_roman"),
  firstNameRoman: text("first_name_roman"),
  gender: text("gender").notNull(),
  birthEra: text("birth_era").notNull(),
  birthYear: integer("birth_year").notNull(),
  birthMonth: integer("birth_month").notNull(),
  birthDay: integer("birth_day").notNull(),
  careLevel: text("care_level").notNull(),
  stomaManagement: boolean("stoma_management").notNull().default(false),
  photoUrl: text("photo_url"),
  moveInDate: text("move_in_date"),
  movedOutAt: text("moved_out_at"),
  movedOutReason: text("moved_out_reason"),
  hospitalizedAt: text("hospitalized_at"),
  hospitalizedReason: text("hospitalized_reason"),
  characterNotes: text("character_notes"),
  clinic1: text("clinic1"),
  clinic2: text("clinic2"),
  medicalHistory: text("medical_history"),
  doctorInstructions: text("doctor_instructions"),
  keyPersonName: text("key_person_name"),
  keyPersonRelation: text("key_person_relation"),
  keyPersonMemo: text("key_person_memo"),
  keyPersonAddress: text("key_person_address"),
  keyPersonTel1: text("key_person_tel1"),
  careManagerCompany: text("care_manager_company"),
  careManagerName: text("care_manager_name"),
  mealTextureBreakfast: text("meal_texture_breakfast"),
  mealTextureLunch: text("meal_texture_lunch"),
  mealTextureDinner: text("meal_texture_dinner"),
  mealsBreakfastEnabled: boolean("meals_breakfast_enabled").notNull().default(true),
  mealsLunchEnabled: boolean("meals_lunch_enabled").notNull().default(true),
  mealsDinnerEnabled: boolean("meals_dinner_enabled").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertResidentSchema = createInsertSchema(residentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertResident = z.infer<typeof insertResidentSchema>;
export type Resident = typeof residentsTable.$inferSelect;
