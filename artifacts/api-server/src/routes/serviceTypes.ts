import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { db, serviceTypesTable, SERVICE_CATEGORIES } from "@workspace/db";

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  shortLabel: z.string().min(1),
  category: z.enum(SERVICE_CATEGORIES),
  durationMinutes: z.number().int().min(5).max(480),
  unitPrice: z.number().int().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

router.get("/service-types", async (req, res): Promise<void> => {
  const isActiveParam = req.query.isActive;
  let query = db
    .select()
    .from(serviceTypesTable)
    .orderBy(asc(serviceTypesTable.sortOrder), asc(serviceTypesTable.name));
  if (isActiveParam !== undefined) {
    const rows = await db
      .select()
      .from(serviceTypesTable)
      .where(eq(serviceTypesTable.isActive, isActiveParam === "true"))
      .orderBy(asc(serviceTypesTable.sortOrder), asc(serviceTypesTable.name));
    res.json(rows);
    return;
  }
  const rows = await query;
  res.json(rows);
});

router.get("/service-types/:id", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(serviceTypesTable)
    .where(eq(serviceTypesTable.id, req.params.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(rows[0]);
});

router.post("/service-types", async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const [created] = await db.insert(serviceTypesTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch("/service-types/:id", async (req, res): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const [updated] = await db
    .update(serviceTypesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(serviceTypesTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/service-types/:id", async (req, res): Promise<void> => {
  const result = await db
    .delete(serviceTypesTable)
    .where(eq(serviceTypesTable.id, req.params.id))
    .returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

export default router;
