import { Router } from "express";
import { and, eq, isNull, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { residentServicesTable } from "@workspace/db/schema/resident-services";

const router = Router();
const timeRe = /^[0-2][0-9]:[0-5][0-9]$/;

const createSchema = z.object({
  residentId: z.number().int(),
  serviceTypeId: z.string().uuid(),
  defaultStartTime: z.string().regex(timeRe),
  defaultDurationMinutes: z.number().int().min(15).max(480),
  weekdays: z.array(z.number().int().min(0).max(6)),
  preferredShiftTypeId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const updateSchema = createSchema.partial().extend({
  terminatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  terminationReason: z.string().nullable().optional(),
});

router.get("/resident-services", async (req, res) => {
  const { residentId, activeOnly } = req.query;
  const conditions = [];
  if (residentId) conditions.push(eq(residentServicesTable.residentId, parseInt(String(residentId))));
  if (activeOnly === "true") conditions.push(isNull(residentServicesTable.terminatedAt));
  const rows = await db
    .select()
    .from(residentServicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(residentServicesTable.effectiveFrom));
  res.json(rows);
});

router.get("/residents/:id/services", async (req, res) => {
  const rows = await db
    .select()
    .from(residentServicesTable)
    .where(eq(residentServicesTable.residentId, parseInt(req.params.id)))
    .orderBy(asc(residentServicesTable.effectiveFrom));
  res.json(rows);
});

router.get("/resident-services/:id", async (req, res) => {
  const [row] = await db.select().from(residentServicesTable).where(eq(residentServicesTable.id, req.params.id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/resident-services", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [created] = await db.insert(residentServicesTable).values(parsed.data as any).returning();
  res.status(201).json(created);
});

router.patch("/resident-services/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [updated] = await db
    .update(residentServicesTable)
    .set({ ...parsed.data as any, updatedAt: new Date() })
    .where(eq(residentServicesTable.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/resident-services/:id", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [updated] = await db
    .update(residentServicesTable)
    .set({ terminatedAt: today, updatedAt: new Date() })
    .where(eq(residentServicesTable.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
