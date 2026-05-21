import { Router } from "express";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { z } from "zod";
import { db, shiftsTable } from "@workspace/db";

const router = Router();

const upsertSchema = z.object({
  staffId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().uuid(),
  slotLabel: z.string().default(""),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get("/shifts", async (req, res) => {
  const { date, from, to, staffId } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];
  if (date) conditions.push(eq(shiftsTable.date, String(date)));
  if (from) conditions.push(gte(shiftsTable.date, String(from)));
  if (to) conditions.push(lte(shiftsTable.date, String(to)));
  if (staffId) conditions.push(eq(shiftsTable.staffId, parseInt(String(staffId))));

  const rows = await db
    .select()
    .from(shiftsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(shiftsTable.date), asc(shiftsTable.shiftTypeId));
  res.json(rows);
});

router.post("/shifts", async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [created] = await db
    .insert(shiftsTable)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [shiftsTable.date, shiftsTable.shiftTypeId, shiftsTable.slotLabel, shiftsTable.staffId],
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(created);
});

router.post("/shifts/bulk", async (req, res) => {
  const bulkSchema = z.object({ shifts: z.array(upsertSchema) });
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  await db.transaction(async (tx) => {
    for (const s of parsed.data.shifts) {
      await tx.insert(shiftsTable).values(s).onConflictDoUpdate({
        target: [shiftsTable.date, shiftsTable.shiftTypeId, shiftsTable.slotLabel, shiftsTable.staffId],
        set: { ...s, updatedAt: new Date() },
      });
    }
  });
  res.json({ ok: true });
});

router.delete("/shifts/:id", async (req, res) => {
  const result = await db.delete(shiftsTable).where(eq(shiftsTable.id, req.params.id)).returning();
  if (result.length === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
