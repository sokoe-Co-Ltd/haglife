import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { transferRequestsTable } from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";

const router: IRouter = Router();

const CreateBody = z.object({
  title: z.string().min(1),
  payeeCompany: z.string().min(1),
  payerCompany: z.string().min(1),
  dueDate: z.string().min(1),
  status: z.enum(["未処理", "処理済"]).default("未処理"),
  amount: z.number().int().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  requestedByName: z.string().min(1),
  bankInfo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const UpdateBody = z.object({
  title: z.string().min(1).optional(),
  payeeCompany: z.string().min(1).optional(),
  payerCompany: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  status: z.enum(["未処理", "処理済"]).optional(),
  amount: z.number().int().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  requestedByName: z.string().min(1).optional(),
  bankInfo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// GET /transfer-requests
router.get("/transfer-requests", async (req, res) => {
  const { status, sort } = req.query as { status?: string; sort?: string };

  let rows = await db
    .select()
    .from(transferRequestsTable)
    .orderBy(
      sort === "payer_company"
        ? asc(transferRequestsTable.payerCompany)
        : asc(transferRequestsTable.dueDate),
      asc(transferRequestsTable.id),
    );

  if (status === "未処理" || status === "処理済") {
    rows = rows.filter((r) => r.status === status);
  }

  return res.json(rows);
});

// POST /transfer-requests
router.post("/transfer-requests", async (req, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const [row] = await db
    .insert(transferRequestsTable)
    .values(parsed.data)
    .returning();
  return res.status(201).json(row);
});

// PATCH /transfer-requests/:id
router.patch("/transfer-requests/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });

  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }

  const [row] = await db
    .update(transferRequestsTable)
    .set(updateData)
    .where(eq(transferRequestsTable.id, id))
    .returning();

  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
});

// DELETE /transfer-requests/:id
router.delete("/transfer-requests/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db
    .delete(transferRequestsTable)
    .where(eq(transferRequestsTable.id, id));
  return res.status(204).end();
});

export default router;
