import { Router, type IRouter } from "express";
import { eq, desc, inArray, asc } from "drizzle-orm";
import {
  db, routeSheetsTable, routeSheetRowsTable, routeSheetCellsTable, visitConflictsView,
  routeSheetTemplatesTable, routeSheetTemplateRowsTable,
  shiftTypesTable, shiftsTable, staffTable,
} from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CellInput = z.object({
  id: z.number().int().optional(),
  startTime: z.string(),
  endTime: z.string(),
  isBreak: z.boolean().default(false),
  residentName: z.string().nullable().optional(),
  serviceLabel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  residentId: z.number().int().nullable().optional(),
  serviceTypeId: z.string().nullable().optional(),
});

const RowInput = z.object({
  id: z.number().int().optional(),
  staffName: z.string(),
  shiftType: z.string().default("日"),
  sortOrder: z.number().int().default(0),
  staffId: z.number().int().nullable().optional(),
  cells: z.array(CellInput).default([]),
});

const UpsertBody = z.object({
  headerNote: z.string().nullable().optional(),
  dayServiceNote: z.string().nullable().optional(),
  specialNote: z.string().nullable().optional(),
  rows: z.array(RowInput).default([]),
});

async function buildSheet(sheetId: number) {
  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.id, sheetId),
  });
  if (!sheet) return null;

  const rows = await db
    .select()
    .from(routeSheetRowsTable)
    .where(eq(routeSheetRowsTable.routeSheetId, sheetId))
    .orderBy(routeSheetRowsTable.sortOrder);

  const rowsWithCells = await Promise.all(
    rows.map(async (row) => {
      const cells = await db
        .select()
        .from(routeSheetCellsTable)
        .where(eq(routeSheetCellsTable.routeSheetRowId, row.id))
        .orderBy(routeSheetCellsTable.startTime);
      return { ...row, cells };
    })
  );

  const conflicts = await db
    .select()
    .from(visitConflictsView)
    .where(eq(visitConflictsView.routeSheetId, sheetId));

  return {
    ...sheet,
    rows: rowsWithCells,
    conflicts: conflicts.map((c) => ({
      cellAId: c.cellAId,
      cellBId: c.cellBId,
      staffId: c.staffId,
      aStart: c.aStart,
      aEnd: c.aEnd,
      bStart: c.bStart,
      bEnd: c.bEnd,
    })),
  };
}

router.get("/route-sheets", async (req, res): Promise<void> => {
  const date = req.query.date as string | undefined;
  if (date) {
    const sheet = await db.query.routeSheetsTable.findFirst({
      where: eq(routeSheetsTable.date, date),
    });
    if (sheet) {
      res.json({ source: "instance", ...(await buildSheet(sheet.id)) });
      return;
    }

    // No saved instance — try to synthesize from weekday template
    const weekday = new Date(date + "T00:00:00").getDay();
    const [template] = await db
      .select()
      .from(routeSheetTemplatesTable)
      .where(eq(routeSheetTemplatesTable.weekday, weekday))
      .limit(1);

    if (!template) {
      res.json({ source: "empty", rows: [], conflicts: [] });
      return;
    }

    const tplRowsData = await db
      .select({ row: routeSheetTemplateRowsTable, shiftType: shiftTypesTable })
      .from(routeSheetTemplateRowsTable)
      .leftJoin(shiftTypesTable, eq(routeSheetTemplateRowsTable.shiftTypeId, shiftTypesTable.id))
      .where(eq(routeSheetTemplateRowsTable.templateId, template.id))
      .orderBy(asc(routeSheetTemplateRowsTable.sortOrder));

    const shiftsData = await db
      .select({ shift: shiftsTable, staff: staffTable })
      .from(shiftsTable)
      .leftJoin(staffTable, eq(shiftsTable.staffId, staffTable.id))
      .where(eq(shiftsTable.date, date));

    const synthesizedRows = tplRowsData.map(({ row: tplRow, shiftType }) => {
      const match = shiftsData.find(
        (s) => s.shift.shiftTypeId === tplRow.shiftTypeId && s.shift.slotLabel === tplRow.slotLabel
      );
      return {
        sortOrder: tplRow.sortOrder,
        shiftType: shiftType?.code ?? "日",
        staffId: match?.shift.staffId ?? null,
        staffName: match?.staff ? `${match.staff.lastName} ${match.staff.firstName}` : "",
        cells: [],
      };
    });

    res.json({
      source: "template",
      templateId: template.id,
      weekday: template.weekday,
      rows: synthesizedRows,
      conflicts: [],
    });
    return;
  }

  const sheets = await db
    .select({ id: routeSheetsTable.id, date: routeSheetsTable.date })
    .from(routeSheetsTable)
    .orderBy(desc(routeSheetsTable.date))
    .limit(90);
  res.json(sheets);
});

router.get("/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (!sheet) {
    res.json(null);
    return;
  }
  res.json(await buildSheet(sheet.id));
});

router.put("/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const parsed = UpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { rows, ...sheetData } = parsed.data;

  let sheetId: number;
  const existing = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });

  if (existing) {
    await db.update(routeSheetsTable).set({
      ...sheetData,
      updatedAt: new Date(),
    }).where(eq(routeSheetsTable.id, existing.id));
    sheetId = existing.id;
  } else {
    const [created] = await db.insert(routeSheetsTable).values({ date, ...sheetData }).returning();
    sheetId = created.id;
  }

  await db.delete(routeSheetRowsTable).where(eq(routeSheetRowsTable.routeSheetId, sheetId));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [insertedRow] = await db.insert(routeSheetRowsTable).values({
      routeSheetId: sheetId,
      staffName: row.staffName,
      shiftType: row.shiftType,
      sortOrder: row.sortOrder ?? i,
      staffId: row.staffId ?? null,
    }).returning();

    if (row.cells.length > 0) {
      await db.insert(routeSheetCellsTable).values(
        row.cells.map((cell) => ({
          routeSheetRowId: insertedRow.id,
          startTime: cell.startTime,
          endTime: cell.endTime,
          isBreak: cell.isBreak,
          residentName: cell.residentName ?? null,
          serviceLabel: cell.serviceLabel ?? null,
          notes: cell.notes ?? null,
          residentId: cell.residentId ?? null,
          serviceTypeId: cell.serviceTypeId ?? null,
        }))
      );
    }
  }

  res.json(await buildSheet(sheetId));
});

router.delete("/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (!sheet) {
    res.status(404).json({ error: "ルート票が見つかりません" });
    return;
  }
  await db.delete(routeSheetsTable).where(eq(routeSheetsTable.id, sheet.id));
  res.sendStatus(204);
});

export default router;
