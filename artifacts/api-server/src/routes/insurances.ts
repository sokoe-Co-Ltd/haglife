import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, insurancesTable } from "@workspace/db";
import {
  CreateInsuranceBody,
  UpdateInsuranceBody,
  UpdateInsuranceParams,
  DeleteInsuranceParams,
  ListInsurancesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/insurances", async (req, res): Promise<void> => {
  const query = ListInsurancesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(insurancesTable)
    .where(eq(insurancesTable.residentId, query.data.resident_id));
  res.json(rows);
});

router.post("/insurances", async (req, res): Promise<void> => {
  const parsed = CreateInsuranceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [insurance] = await db.insert(insurancesTable).values(parsed.data).returning();
  res.status(201).json(insurance);
});

router.patch("/insurances/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateInsuranceParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInsuranceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [insurance] = await db
    .update(insurancesTable)
    .set(updateData)
    .where(eq(insurancesTable.id, params.data.id))
    .returning();
  if (!insurance) {
    res.status(404).json({ error: "保険情報が見つかりません" });
    return;
  }
  res.json(insurance);
});

router.delete("/insurances/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteInsuranceParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(insurancesTable).where(eq(insurancesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
