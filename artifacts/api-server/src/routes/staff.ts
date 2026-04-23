import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import {
  CreateStaffBody,
  UpdateStaffBody,
  GetStaffParams,
  UpdateStaffParams,
  DeleteStaffParams,
  ListStaffQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/staff", async (req, res): Promise<void> => {
  const query = ListStaffQueryParams.safeParse(req.query);
  const rows = await db
    .select()
    .from(staffTable)
    .where(
      query.success && query.data.visible_only
        ? eq(staffTable.isVisible, true)
        : undefined,
    )
    .orderBy(staffTable.lastNameKana);
  res.json(rows);
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [staff] = await db.insert(staffTable).values(parsed.data).returning();
  res.status(201).json(staff);
});

router.get("/staff/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetStaffParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, params.data.id));
  if (!staff) {
    res.status(404).json({ error: "職員が見つかりません" });
    return;
  }
  res.json(staff);
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateStaffParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [staff] = await db
    .update(staffTable)
    .set(updateData)
    .where(eq(staffTable.id, params.data.id))
    .returning();
  if (!staff) {
    res.status(404).json({ error: "職員が見つかりません" });
    return;
  }
  res.json(staff);
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteStaffParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(staffTable).where(eq(staffTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
