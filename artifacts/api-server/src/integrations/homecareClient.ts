/**
 * homecare-route-app（訪問介護ルート表アプリ）の連携 API クライアント（サーバー間）。
 *
 * homecare が提供する読み取り専用 API `GET /api/routes?date=YYYY-MM-DD` を、
 * api-server（サーバー側）から API キー（Bearer）付きで叩く。API キーは秘密なので
 * 必ずサーバー側の環境変数に置き、フロントには出さない。
 *
 * 契約（実装と 1 対 1）: homecare リポの docs/api/openapi.yaml。
 * 本ファイルの型はその契約から転記したもの（homecare 側が変わったら追随すること）。
 *
 * 必要な環境変数:
 *   HOMECARE_API_BASE_URL  例: https://xxxx.vercel.app（末尾スラッシュ無し）
 *   HOMECARE_API_KEY       homecare 管理画面で発行した API キー（hrk_...）
 */

/** 勤務帯（明→早→日→遅→夜） */
export type HomecareShiftBand = "dawn" | "early" | "day" | "late" | "night";

/** 訪問の状態 */
export type HomecareVisitStatus =
  | "planned"
  | "in_progress"
  | "done"
  | "cancelled"
  | "substituted"
  | "not_performed";

export type HomecareVariant = "working" | "official";

/** 訪問 1 件（予定情報のみ。実施記録・実績時刻は含まれない） */
export interface HomecareVisit {
  id: string;
  sequenceNo: number;
  band: HomecareShiftBand | null;
  bandColumn: number;
  clientId: string;
  clientName: string;
  /** 担当スタッフ UID（未割当は空文字）。homecare の Firebase UID（文字列） */
  assigneeStaffId: string;
  serviceBillingCode: string | null;
  serviceName: string | null;
  /** 予定開始（HH:MM） */
  scheduledStart: string;
  /** 予定終了（HH:MM） */
  scheduledEnd: string;
  status: HomecareVisitStatus;
}

export interface HomecareStaff {
  /** homecare の Firebase UID（文字列） */
  staffId: string;
  displayName: string;
}

/** GET /api/routes のレスポンス本体 */
export interface HomecareRouteResponse {
  date: string;
  variant: HomecareVariant;
  exists: boolean;
  routeStatus: string | null;
  generatedAt: string | null;
  bands: Partial<Record<HomecareShiftBand, number>> | null;
  staff: HomecareStaff[];
  visits: HomecareVisit[];
}

/** homecare 連携の設定不足・通信・認証・レート等のエラー */
export class HomecareApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HomecareApiError";
  }
}

function getConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.HOMECARE_API_BASE_URL;
  const apiKey = process.env.HOMECARE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new HomecareApiError(
      "HOMECARE_API_BASE_URL / HOMECARE_API_KEY が未設定です。api-server の環境変数に設定してください。",
      500,
      "not_configured",
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * homecare の指定日ルート表を取得する。
 * @param date YYYY-MM-DD
 * @throws HomecareApiError 設定不足 / 認証失敗 / レート超過 / 通信失敗時
 */
export async function fetchHomecareRoutes(
  date: string,
): Promise<HomecareRouteResponse> {
  if (!DATE_RE.test(date)) {
    throw new HomecareApiError("date は YYYY-MM-DD 形式で指定してください。", 400, "invalid_date");
  }
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/api/routes?date=${encodeURIComponent(date)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
  } catch (err) {
    throw new HomecareApiError(
      `homecare API への接続に失敗しました: ${err instanceof Error ? err.message : "unknown"}`,
      502,
      "network_error",
    );
  }

  if (!res.ok) {
    // homecare は { error: "unauthorized" | "invalid_date" | ... } を返す
    let code: string | undefined;
    try {
      code = ((await res.json()) as { error?: string }).error;
    } catch {
      // ignore
    }
    throw new HomecareApiError(
      `homecare API がエラーを返しました（HTTP ${res.status}${code ? ` / ${code}` : ""}）`,
      res.status,
      code,
    );
  }

  return (await res.json()) as HomecareRouteResponse;
}
