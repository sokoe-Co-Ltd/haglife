import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { db, shiftTypesTable } from "@workspace/db";

const router = Router();

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultStartTime: z.string().nullable().optional(),
  defaultEndTime: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  color: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});
const updateSchema = createSchema.partial();

router.get("/shift-types", async (req, res) => {
  const isActive = req.query.isActive;
  const rows = await db
    .select()
    .from(shiftTypesTable)
    .where(isActive !== undefined ? eq(shiftTypesTable.isActive, isActive === "true") : undefined)
    .orderBy(asc(shiftTypesTable.sortOrder), asc(shiftTypesTable.name));
  return res.json(rows);
});

router.get("/shift-types/:id", async (req, res) => {
  const [row] = await db.select().from(shiftTypesTable).where(eq(shiftTypesTable.id, req.params.id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.post("/shift-types", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [created] = await db.insert(shiftTypesTable).values(parsed.data).returning();
  return res.status(201).json(created);
});

router.patch("/shift-types/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [updated] = await db
    .update(shiftTypesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(shiftTypesTable.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

router.delete("/shift-types/:id", async (req, res) => {
  const result = await db.delete(shiftTypesTable).where(eq(shiftTypesTable.id, req.params.id)).returning();
  if (result.length === 0) return res.status(404).json({ error: "Not found" });
  return res.status(204).send();
});

export default router;
