import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const insurancesTable = pgTable("insurances", {
  id: serial("id").primaryKey(),
  residentId: integer("resident_id").notNull(),
  insuranceType: text("insurance_type"),
  insuranceNumber: text("insurance_number"),
  validFrom: text("valid_from"),
  validUntil: text("valid_until"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertInsuranceSchema = createInsertSchema(insurancesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInsurance = z.infer<typeof insertInsuranceSchema>;
export type Insurance = typeof insurancesTable.$inferSelect;
