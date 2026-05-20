import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const serviceTypesTable = pgTable("service_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortLabel: text("short_label").notNull(),
  category: text("category").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  unitPrice: integer("unit_price"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceType = typeof serviceTypesTable.$inferSelect;
export type NewServiceType = typeof serviceTypesTable.$inferInsert;

export const SERVICE_CATEGORIES = [
  "body",
  "life",
  "bathing",
  "toileting",
  "accompaniment",
  "meal",
  "cleaning",
  "other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
