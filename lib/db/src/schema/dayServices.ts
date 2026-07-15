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

export const dayServicesTable = pgTable("day_services", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  facilityName: text("facility_name"),
  usageDays: text("usage_days").array().notNull().default([]),
  itemsToBring: text("items_to_bring"),
  itemLocations: text("item_locations"),
  itemPhotoUrl: text("item_photo_url"),
  itemPhotoUrls: text("item_photo_urls").array().notNull().default([]),
  isPrepared: boolean("is_prepared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDayServiceSchema = createInsertSchema(dayServicesTable).omit(
  { id: true, createdAt: true },
);
export type InsertDayService = z.infer<typeof insertDayServiceSchema>;
export type DayService = typeof dayServicesTable.$inferSelect;
