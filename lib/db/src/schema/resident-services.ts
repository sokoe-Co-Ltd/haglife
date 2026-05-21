import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const residentServicesTable = pgTable("resident_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  residentId: integer("resident_id").notNull(),
  serviceTypeId: uuid("service_type_id").notNull(),
  defaultStartTime: text("default_start_time").notNull(),
  defaultDurationMinutes: integer("default_duration_minutes").notNull(),
  weekdays: jsonb("weekdays").notNull().default("[]"),
  preferredShiftTypeId: uuid("preferred_shift_type_id"),
  notes: text("notes"),
  effectiveFrom: text("effective_from").notNull(),
  terminatedAt: text("terminated_at"),
  terminationReason: text("termination_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ResidentService = typeof residentServicesTable.$inferSelect;
export type NewResidentService = typeof residentServicesTable.$inferInsert;
