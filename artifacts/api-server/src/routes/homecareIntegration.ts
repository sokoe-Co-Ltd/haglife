/**
 * homecare 連携（読み取り）ルート。homecare のルート表を取得し、route_sheet へ取り込む。
 *
 * 方向: homecare が提供 → Home-Navi が消費（homecare は外部 API）。
 * 契約: homecare リポ docs/api/openapi.yaml。クライアント: ../integrations/homecareClient.ts。
 *
 * エンドポイント:
 *   GET  /api/integrations/homecare/routes?date=YYYY-MM-DD
 *        homecare の生レスポンスをそのまま返す（疎通・内容確認用のプレビュー）。
 *   POST /api/integrations/homecare/sync   body: { date, dryRun?, force? }
 *        homecare のルートを route_sheet 取り込みプランへ写像。
 *        - dryRun（既定 true）: DB に書かず、写像結果（プラン）だけ返す。
 *        - dryRun=false: その日の route_sheet が **無い場合のみ** sheet/rows/cells を作成する。
 *          既存シートがある日は上書きせず 409（materialize 済み/編集済みを保護）。
 *          再取り込みしたい場合は既存シートを削除してから実行する（force は将来対応）。
 *
 * 安全策: 本ルートは homecare のキーを持つサーバー間連携。書き込みは既定 dry-run＋既存保護。
 *         個人情報（利用者氏名）を扱うため、公開時は認証/認可の付与を検討すること。
 */

import { Router, type IRouter, type Response } from "express";
import { z } from "zod";

import { fetchHomecareRoutes, HomecareApiError } from "../integrations/homecareClient";
import { syncHomecareRouteForDate } from "../integrations/homecareSync";

const router: IRouter = Router();

const DateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date は YYYY-MM-DD 形式で指定してください。"),
});

const SyncBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date は YYYY-MM-DD 形式で指定してください。"),
  /** 既定 true（安全側）。false のときだけ DB へ書き込む。 */
  dryRun: z.boolean().default(true),
});

/** HomecareApiError を HTTP に写像する。 */
function respondHomecareError(res: Response, err: unknown) {
  if (err instanceof HomecareApiError) {
    // 設定不足/認証/レートなどは homecare 側の status を尊重（無ければ 502）
    res.status(err.status ?? 502).json({ error: err.code ?? "homecare_error", message: err.message });
    return true;
  }
  return false;
}

/**
 * GET /integrations/homecare/routes?date=YYYY-MM-DD
 * homecare の生レスポンスをプレビュー（疎通確認）。
 */
router.get("/integrations/homecare/routes", async (req, res) => {
  const parsed = DateQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: parsed.error.issues[0]?.message });
    return;
  }
  try {
    const data = await fetchHomecareRoutes(parsed.data.date);
    res.json(data);
  } catch (err) {
    if (respondHomecareError(res, err)) return;
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /integrations/homecare/sync  body: { date, dryRun? }
 * homecare のルートを写像し、dryRun でなければ route_sheet を作成する（既存日は 409）。
 */
router.post("/integrations/homecare/sync", async (req, res) => {
  const parsed = SyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: parsed.error.issues[0]?.message });
    return;
  }
  const { date, dryRun } = parsed.data;

  try {
    const result = await syncHomecareRouteForDate(date, { dryRun });
    if (result.kind === "dryRun") {
      res.json({ dryRun: true, plan: result.plan });
    } else if (result.kind === "exists") {
      res.status(409).json({
        error: "sheet_exists",
        message: `${date} のルート表は既に存在します。上書きしません（再取り込みは既存シート削除後に実行）。`,
        routeSheetId: result.routeSheetId,
      });
    } else {
      res.status(201).json({
        dryRun: false,
        imported: {
          routeSheetId: result.routeSheetId,
          rowCount: result.rowCount,
          cellCount: result.cellCount,
        },
      });
    }
  } catch (err) {
    if (respondHomecareError(res, err)) return;
    res.status(500).json({
      error: "import_failed",
      message: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
