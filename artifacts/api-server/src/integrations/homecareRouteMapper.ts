/**
 * homecare のルート表レスポンス → route_sheet（sheet/rows/cells）取り込みプランへの写像（純粋関数）。
 *
 * === 写像の設計判断（要 Home-Navi 側の確認）===
 *
 * 1. **担当スタッフ**: homecare の assigneeStaffId は Firebase UID（文字列）で、こちらの
 *    staffId（integer）とは体系が違う。よって row.staffId は null にし、staffName（表示名）
 *    だけで表す。突合はこちら側の職員マスターと staffName（or 別途対応表）で行う想定。
 *    未割当（assigneeStaffId 空）の訪問は「未割当」という 1 行にまとめる。
 *
 * 2. **status**: homecare の状態語彙（planned/in_progress/done/cancelled/substituted/
 *    not_performed）はこちらの語彙と一致保証がないため、**全セルを "planned"（計画取り込み）**
 *    として入れ、元の homecare status と visit.id は cell.notes に "homecare:{id} status:{s}"
 *    形式で残す（トレース＆再取り込みの冪等キー）。実態列（actualStaffId 等）は触らない。
 *    → status のマッピングを確定したら、この既定値を差し替える。
 *
 * 3. **shiftType**: homecare の band（明/早/日/遅/夜）を JP 1 文字へ写す。band が無い訪問だけの
 *    行は既定 "日"。1 スタッフの行に複数 band が混在する場合は最頻の band を採用する。
 *
 * 4. **serviceLabel**: serviceName を優先、無ければ serviceBillingCode、どちらも無ければ null。
 *
 * I/O 非依存の純粋関数。DB 書き込みは呼び出し側（routes/homecareIntegration.ts）で行う。
 */

import type { HomecareRouteResponse, HomecareShiftBand } from "./homecareClient";

/** band → shiftType（JP 1 文字） */
const BAND_TO_SHIFT_LABEL: Record<HomecareShiftBand, string> = {
  dawn: "明",
  early: "早",
  day: "日",
  late: "遅",
  night: "夜",
};

export interface SheetPlanCell {
  startTime: string;
  endTime: string;
  isBreak: boolean;
  residentName: string | null;
  serviceLabel: string | null;
  notes: string | null;
  /** 常に "planned"（設計判断 2 参照） */
  status: string;
}

export interface SheetPlanRow {
  staffName: string;
  shiftType: string;
  sortOrder: number;
  /** homecare の UID とは体系が違うため常に null（設計判断 1 参照） */
  staffId: number | null;
  cells: SheetPlanCell[];
}

export interface SheetPlan {
  date: string;
  /** 取り込み元の識別（route_sheets.materialized_from_template_id に格納） */
  source: string;
  rowCount: number;
  cellCount: number;
  rows: SheetPlanRow[];
}

/** homecare のルート表を route_sheet 取り込みプランへ変換する（純粋）。 */
export function mapHomecareRoutesToSheetPlan(
  res: HomecareRouteResponse,
): SheetPlan {
  const nameOf = new Map<string, string>();
  for (const s of res.staff) nameOf.set(s.staffId, s.displayName);

  const UNASSIGNED = "未割当";
  // 担当（表示名）ごとにグルーピング。順序は最初に登場した順を保つ。
  const groups = new Map<string, HomecareRouteResponse["visits"]>();
  const order: string[] = [];
  for (const v of res.visits) {
    const key = v.assigneeStaffId
      ? (nameOf.get(v.assigneeStaffId) ?? v.assigneeStaffId)
      : UNASSIGNED;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(v);
  }

  const rows: SheetPlanRow[] = order.map((staffName, i) => {
    const visits = groups.get(staffName)!;

    // 最頻の band から shiftType を決める（band 無しは除外、全て無しなら "日"）
    const bandCount = new Map<HomecareShiftBand, number>();
    for (const v of visits) {
      if (v.band) bandCount.set(v.band, (bandCount.get(v.band) ?? 0) + 1);
    }
    let shiftBand: HomecareShiftBand | null = null;
    let max = 0;
    for (const [b, c] of bandCount) {
      if (c > max) {
        max = c;
        shiftBand = b;
      }
    }
    const shiftType = shiftBand ? BAND_TO_SHIFT_LABEL[shiftBand] : "日";

    // 時刻順に安定ソート（予定開始）
    const sorted = [...visits].sort((a, b) =>
      a.scheduledStart < b.scheduledStart
        ? -1
        : a.scheduledStart > b.scheduledStart
          ? 1
          : a.sequenceNo - b.sequenceNo,
    );

    const cells: SheetPlanCell[] = sorted.map((v) => ({
      startTime: v.scheduledStart,
      endTime: v.scheduledEnd,
      isBreak: false,
      residentName: v.clientName || null,
      serviceLabel: v.serviceName ?? v.serviceBillingCode ?? null,
      notes: `homecare:${v.id} status:${v.status}`,
      status: "planned",
    }));

    return { staffName, shiftType, sortOrder: i, staffId: null, cells };
  });

  const cellCount = rows.reduce((n, r) => n + r.cells.length, 0);
  return {
    date: res.date,
    source: `homecare:${res.variant}`,
    rowCount: rows.length,
    cellCount,
    rows,
  };
}
