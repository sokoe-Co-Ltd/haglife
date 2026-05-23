import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  routeSheetsTable,
  routeSheetRowsTable,
  routeSheetCellsTable,
  routeSheetCellAuditLogTable,
  routeSheetTemplatesTable,
  routeSheetTemplateRowsTable,
  routeSheetTemplateCellsTable,
  staffTable,
  residentsTable,
  serviceTypesTable,
  residentServicesTable,
  shiftTypesTable,
} from "@workspace/db";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────
// GET /api/audit/route-sheets/:date
// 監査画面メインビュー：当日の全セル（skipped 含む）＋ 計画/実態 を JOIN
// ─────────────────────────────────────────────────────────────────
router.get("/audit/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;

  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (!sheet) {
    res.json({ date, cells: [] });
    return;
  }

  const rows = await db
    .select()
    .from(routeSheetRowsTable)
    .where(eq(routeSheetRowsTable.routeSheetId, sheet.id));
  const rowIds = rows.map((r) => r.id);

  const cells = rowIds.length === 0
    ? []
    : await db
        .select()
        .from(routeSheetCellsTable)
        .where(inArray(routeSheetCellsTable.routeSheetRowId, rowIds));

  // 名前解決のためのマスタを一括ロード
  const staffIds = new Set<number>();
  const serviceTypeIds = new Set<string>();
  const residentIds = new Set<number>();
  for (const c of cells) {
    if (c.plannedStaffId) staffIds.add(c.plannedStaffId);
    if (c.actualStaffId) staffIds.add(c.actualStaffId);
    if (c.plannedServiceTypeId) serviceTypeIds.add(c.plannedServiceTypeId);
    if (c.serviceTypeId) serviceTypeIds.add(c.serviceTypeId);
    if (c.residentId) residentIds.add(c.residentId);
  }
  for (const r of rows) {
    if (r.staffId) staffIds.add(r.staffId);
  }

  const [staffList, serviceTypeList, residentList, shiftTypeList] = await Promise.all([
    staffIds.size === 0
      ? []
      : db.select().from(staffTable).where(inArray(staffTable.id, [...staffIds])),
    serviceTypeIds.size === 0
      ? []
      : db.select().from(serviceTypesTable).where(inArray(serviceTypesTable.id, [...serviceTypeIds])),
    residentIds.size === 0
      ? []
      : db.select().from(residentsTable).where(inArray(residentsTable.id, [...residentIds])),
    db.select().from(shiftTypesTable),
  ]);

  const staffMap = new Map(staffList.map((s) => [s.id, `${s.lastName} ${s.firstName}`]));
  const serviceTypeMap = new Map(serviceTypeList.map((s) => [s.id, s.shortLabel]));
  const residentMap = new Map(residentList.map((r) => [r.id, `${r.lastName} ${r.firstName}`]));
  const rowMap = new Map(rows.map((r) => [r.id, r]));
  const shiftTypeByCode = new Map(shiftTypeList.map((s) => [s.code, s]));

  const view = cells.map((c) => {
    const row = rowMap.get(c.routeSheetRowId);
    const st = row ? shiftTypeByCode.get(row.shiftType) : null;
    return {
      id: c.id,
      rowId: c.routeSheetRowId,
      rowShiftType: row?.shiftType ?? null,
      rowShiftTypeColor: st?.color ?? null,
      plannedStaffId: c.plannedStaffId,
      plannedStaffName: c.plannedStaffId ? (staffMap.get(c.plannedStaffId) ?? null) : null,
      actualStaffId: c.actualStaffId,
      actualStaffName: c.actualStaffId ? (staffMap.get(c.actualStaffId) ?? null) : null,
      plannedStartTime: c.plannedStartTime,
      plannedEndTime: c.plannedEndTime,
      plannedServiceTypeId: c.plannedServiceTypeId,
      plannedServiceLabel: c.plannedServiceTypeId
        ? (serviceTypeMap.get(c.plannedServiceTypeId) ?? null)
        : null,
      startTime: c.startTime,
      endTime: c.endTime,
      serviceTypeId: c.serviceTypeId,
      serviceLabel: c.serviceTypeId ? (serviceTypeMap.get(c.serviceTypeId) ?? null) : null,
      residentId: c.residentId,
      residentName: c.residentId ? (residentMap.get(c.residentId) ?? null) : null,
      status: c.status,
      skipReason: c.skipReason,
      staffReassigned: c.staffReassigned,
      modifiedNote: c.modifiedNote,
      modifiedAt: c.modifiedAt,
      isAdHoc: c.isAdHoc,
      isBreak: c.isBreak,
    };
  });

  res.json({ date, sheetId: sheet.id, cells: view });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/audit/notifications/:date
// 追加サービス通知（isAdHoc=true）のセル一覧
// ─────────────────────────────────────────────────────────────────
router.get("/audit/notifications/:date", async (req, res): Promise<void> => {
  const { date } = req.params;

  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (!sheet) {
    res.json({ date, notifications: [] });
    return;
  }

  const rows = await db
    .select()
    .from(routeSheetRowsTable)
    .where(eq(routeSheetRowsTable.routeSheetId, sheet.id));
  const rowIds = rows.map((r) => r.id);

  const cells = rowIds.length === 0
    ? []
    : await db
        .select()
        .from(routeSheetCellsTable)
        .where(
          and(
            inArray(routeSheetCellsTable.routeSheetRowId, rowIds),
            eq(routeSheetCellsTable.isAdHoc, true)
          )
        );

  const staffIds = new Set<number>();
  const serviceTypeIds = new Set<string>();
  const residentIds = new Set<number>();
  for (const c of cells) {
    if (c.actualStaffId) staffIds.add(c.actualStaffId);
    if (c.serviceTypeId) serviceTypeIds.add(c.serviceTypeId);
    if (c.residentId) residentIds.add(c.residentId);
  }

  const [staffList, serviceTypeList, residentList] = await Promise.all([
    staffIds.size === 0
      ? []
      : db.select().from(staffTable).where(inArray(staffTable.id, [...staffIds])),
    serviceTypeIds.size === 0
      ? []
      : db.select().from(serviceTypesTable).where(inArray(serviceTypesTable.id, [...serviceTypeIds])),
    residentIds.size === 0
      ? []
      : db.select().from(residentsTable).where(inArray(residentsTable.id, [...residentIds])),
  ]);
  const staffMap = new Map(staffList.map((s) => [s.id, `${s.lastName} ${s.firstName}`]));
  const serviceTypeMap = new Map(serviceTypeList.map((s) => [s.id, s.shortLabel]));
  const residentMap = new Map(residentList.map((r) => [r.id, `${r.lastName} ${r.firstName}`]));

  const notifications = cells.map((c) => ({
    cellId: c.id,
    startTime: c.startTime,
    endTime: c.endTime,
    residentId: c.residentId,
    residentName: c.residentId ? (residentMap.get(c.residentId) ?? null) : null,
    serviceTypeId: c.serviceTypeId,
    serviceLabel: c.serviceTypeId ? (serviceTypeMap.get(c.serviceTypeId) ?? null) : null,
    actualStaffId: c.actualStaffId,
    actualStaffName: c.actualStaffId ? (staffMap.get(c.actualStaffId) ?? null) : null,
    modifiedAt: c.modifiedAt,
    modifiedNote: c.modifiedNote,
    status: c.status,
  }));

  res.json({ date, notifications });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/audit/notifications/:cellId/accept
// 通知の採用処理（day_only / add_to_template）
// ─────────────────────────────────────────────────────────────────
const AcceptBody = z.object({
  scope: z.enum(["day_only", "add_to_template"]),
  weekday: z.number().int().min(0).max(6).optional(),
});

router.post("/audit/notifications/:cellId/accept", async (req, res): Promise<void> => {
  const cellId = parseInt(req.params.cellId, 10);
  if (Number.isNaN(cellId)) {
    res.status(400).json({ error: "invalid cellId" });
    return;
  }
  const parsed = AcceptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { scope, weekday } = parsed.data;

  const [cell] = await db
    .select()
    .from(routeSheetCellsTable)
    .where(eq(routeSheetCellsTable.id, cellId))
    .limit(1);
  if (!cell) {
    res.status(404).json({ error: "cell not found" });
    return;
  }
  if (!cell.isAdHoc) {
    res.status(400).json({ error: "cell is not an ad-hoc notification" });
    return;
  }

  if (scope === "add_to_template") {
    if (weekday === undefined) {
      res.status(400).json({ error: "weekday is required for add_to_template" });
      return;
    }
    const [template] = await db
      .select()
      .from(routeSheetTemplatesTable)
      .where(eq(routeSheetTemplatesTable.weekday, weekday))
      .limit(1);
    if (!template) {
      res.status(404).json({ error: "template not found for weekday" });
      return;
    }

    // 該当 cell の row を特定 → 同じ shiftType+slotLabel のテンプレ行を探す
    const [row] = await db
      .select()
      .from(routeSheetRowsTable)
      .where(eq(routeSheetRowsTable.id, cell.routeSheetRowId))
      .limit(1);

    let templateRowId: string | null = null;
    if (row) {
      // shiftType (text code) → shift_types.id を逆引き
      const [st] = await db
        .select()
        .from(shiftTypesTable)
        .where(eq(shiftTypesTable.code, row.shiftType))
        .limit(1);
      if (st) {
        const tplRows = await db
          .select()
          .from(routeSheetTemplateRowsTable)
          .where(
            and(
              eq(routeSheetTemplateRowsTable.templateId, template.id),
              eq(routeSheetTemplateRowsTable.shiftTypeId, st.id)
            )
          );
        if (tplRows.length > 1) {
          // route_sheet_rows には slot_label が無く、shiftType だけでは一意特定不可。
          // テンプレ側に複数枠ある場合は曖昧なので明示的にエラー返し、誤マッピングを防ぐ。
          res.status(400).json({
            error: "テンプレートに同一シフト種別の枠が複数あるため、自動マッピングできません。テンプレ画面で手動追加してください",
          });
          return;
        }
        templateRowId = tplRows[0]?.id ?? null;
      }
    }
    if (!templateRowId) {
      res.status(400).json({
        error: "対応するテンプレ行が見つかりません。先にテンプレ側で枠を作成してください",
      });
      return;
    }

    // resident_services を逆引き
    let residentServiceId: string | null = null;
    if (cell.residentId && cell.serviceTypeId) {
      const [rs] = await db
        .select()
        .from(residentServicesTable)
        .where(
          and(
            eq(residentServicesTable.residentId, cell.residentId),
            eq(residentServicesTable.serviceTypeId, cell.serviceTypeId as unknown as string)
          )
        )
        .limit(1);
      residentServiceId = rs?.id ?? null;
    }

    await db.insert(routeSheetTemplateCellsTable).values({
      templateRowId,
      residentServiceId,
      startTime: cell.startTime,
      endTime: cell.endTime,
      isBreak: cell.isBreak,
      notes: cell.notes,
    });
  }

  // 共通：通知を消化（isAdHoc=false, status='added' のまま、modifiedAt 更新）
  await db.update(routeSheetCellsTable)
    .set({
      isAdHoc: false,
      modifiedAt: new Date(),
    })
    .where(eq(routeSheetCellsTable.id, cellId));

  await db.insert(routeSheetCellAuditLogTable).values({
    cellId,
    actorStaffId: null,
    action: "accept_notification",
    beforeJson: cell,
    afterJson: { ...cell, isAdHoc: false },
    reason: scope === "add_to_template" ? `add_to_template (weekday=${weekday})` : "day_only",
  });

  res.json({ ok: true, scope });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/audit/cells/:cellId/history
// セル単位の変更履歴
// ─────────────────────────────────────────────────────────────────
router.get("/audit/cells/:cellId/history", async (req, res): Promise<void> => {
  const cellId = parseInt(req.params.cellId, 10);
  if (Number.isNaN(cellId)) {
    res.status(400).json({ error: "invalid cellId" });
    return;
  }
  const logs = await db
    .select()
    .from(routeSheetCellAuditLogTable)
    .where(eq(routeSheetCellAuditLogTable.cellId, cellId))
    .orderBy(desc(routeSheetCellAuditLogTable.occurredAt));

  // actor 名を解決
  const actorIds = [...new Set(
    logs.map((l) => l.actorStaffId).filter((id): id is number => id != null)
  )];
  const actors = actorIds.length === 0
    ? []
    : await db.select().from(staffTable).where(inArray(staffTable.id, actorIds));
  const actorMap = new Map(actors.map((s) => [s.id, `${s.lastName} ${s.firstName}`]));

  res.json({
    cellId,
    history: logs.map((l) => ({
      id: l.id,
      occurredAt: l.occurredAt,
      actorStaffId: l.actorStaffId,
      actorStaffName: l.actorStaffId ? (actorMap.get(l.actorStaffId) ?? null) : null,
      action: l.action,
      beforeJson: l.beforeJson,
      afterJson: l.afterJson,
      reason: l.reason,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/audit/cells/:cellId/note
// 変更メモを消去（modifiedNote=null）
// ─────────────────────────────────────────────────────────────────
router.delete("/audit/cells/:cellId/note", async (req, res): Promise<void> => {
  const cellId = parseInt(req.params.cellId, 10);
  if (Number.isNaN(cellId)) {
    res.status(400).json({ error: "invalid cellId" });
    return;
  }
  const [cell] = await db
    .select()
    .from(routeSheetCellsTable)
    .where(eq(routeSheetCellsTable.id, cellId))
    .limit(1);
  if (!cell) {
    res.status(404).json({ error: "cell not found" });
    return;
  }

  await db.update(routeSheetCellsTable)
    .set({ modifiedNote: null, modifiedAt: new Date() })
    .where(eq(routeSheetCellsTable.id, cellId));

  await db.insert(routeSheetCellAuditLogTable).values({
    cellId,
    actorStaffId: null,
    action: "clear_note",
    beforeJson: cell,
    afterJson: { ...cell, modifiedNote: null },
    reason: null,
  });

  res.json({ ok: true });
});

export default router;

// Suppress unused (kept for future filtering helpers)
void isNotNull;
