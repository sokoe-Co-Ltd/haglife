import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const facilitySettingsTable = pgTable("facility_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
