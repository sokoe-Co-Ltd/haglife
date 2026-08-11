import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transferRequestsTable = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  payeeCompany: text("payee_company").notNull(),   // 支払う相手（請求元）
  payerCompany: text("payer_company").notNull(),   // 支払い元（自社）
  dueDate: text("due_date").notNull(),             // 振込期限 YYYY-MM-DD
  status: text("status").notNull().default("未処理"), // 未処理 | 処理済
  amount: integer("amount"),                       // 金額（円）
  pdfUrl: text("pdf_url"),                         // 添付PDF URL
  requestedByName: text("requested_by_name").notNull(), // 依頼したメンバー名
  bankInfo: text("bank_info"),   // 振込先口座情報（銀行名・支店・口座番号など）
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTransferRequestSchema = createInsertSchema(
  transferRequestsTable,
).omit({ id: true, createdAt: true });

export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;
export type TransferRequest = typeof transferRequestsTable.$inferSelect;
