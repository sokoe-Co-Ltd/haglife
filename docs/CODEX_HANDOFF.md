# Home-Navi Codex 引き継ぎ資料

## Codexへ最初に送る指示

以下をCodexへそのまま送ってください。

---

このReplitワークスペースの Home-Navi の開発を引き継いでください。

最初に以下を行ってください。

1. リポジトリ全体を作り直さず、既存構成と既存コードを維持する
2. 関連ファイルを読んでから変更する
3. API変更は lib/api-spec/openapi.yaml を先に更新し、codegenを実行する
4. DB変更は lib/db/src/schema と lib/db/migrations の両方を更新する
5. 開発DBへ必要なスキーマ変更を反映するが、production DBを直接変更しない
6. 変更後はAPIと対象画面の型チェックを行う
7. APIまたはWebコード変更後は既存workflowを再起動する
8. PC・スマホ両方で対象画面を確認する
9. 既存の別画面に以前から存在する型エラーを、今回の作業と混同しない

### プロジェクト構成

- Webアプリ: artifacts/home-navi
- APIサーバー: artifacts/api-server
- OpenAPIソース: lib/api-spec/openapi.yaml
- React Query生成クライアント: lib/api-client-react/src/generated
- Zod生成コード: lib/api-zod/src/generated
- Drizzle DBスキーマ: lib/db/src/schema
- SQLマイグレーション: lib/db/migrations

### 起動workflow

- artifacts/home-navi: web
- artifacts/api-server: API Server

### シフト機能の主要ファイル

- シフト表UI: artifacts/home-navi/src/pages/shifts.tsx
- シフト種別UI: artifacts/home-navi/src/pages/shift-types.tsx
- シフトAPI: artifacts/api-server/src/routes/shifts.ts
- シフト種別API: artifacts/api-server/src/routes/shiftTypes.ts
- シフトDB: lib/db/src/schema/shifts.ts
- シフト種別DB: lib/db/src/schema/shift-types.ts
- シフト関連OpenAPI: lib/api-spec/openapi.yaml の /shift-types と /shifts
- 必要人数追加SQL: lib/db/migrations/0006_shift_type_required_staff_count.sql

### DB上のデータ

データ本体はPostgreSQLにあります。主要テーブルは以下です。

- shifts: 職員ごとの日別シフト
- shift_types: 早番・日勤・夜勤などの勤務種別と必要人数
- staff: 職員
- facility_settings: 施設設定
- route_sheets / route_sheet_rows / route_sheet_cells: ルート票

シフト種別には required_staff_count が追加済みです。0の場合は不足判定をしません。
DB接続情報や秘密値をチャットへ表示しないでください。ReplitのDB機能または環境に注入済みの接続設定を使用してください。

### 実装済みのシフト改善

- 週送りと「今週へ戻る」
- 日付ヘッダーと職員名の固定
- スマホの横スワイプ案内
- 読み込み・空・通信エラー表示
- セル保存中・保存成功・保存失敗表示
- シフトコードと開始・終了時刻表示
- シフト種別ごとの必要人数設定
- 日別の不足人数表示
- 週7日勤務の注意表示
- 複数セルを選択して一括設定
- 前週シフトのコピー
- 上書き件数の事前確認

### 一括保存APIの重要な仕様

POST /shifts/bulk は、同じ staffId・date・slotLabel の既存シフトを削除してから新しいシフトを登録します。これにより勤務種別変更時に旧データが残らないようにしています。処理はDBトランザクション内です。この置換動作を壊さないでください。

### 次の候補作業

- 施設ごとに連勤上限を変更できるようにする
- 夜勤など日付をまたぐ勤務の重複検知
- 希望シフト・下書き・確定・公開済みの状態分離
- 公開前の変更差分確認
- スタッフへの通知と既読確認
- 資格別の必要配置人数（現状staffに資格データはない）

### 調査資料

- research/shift-scheduling-competitive-report.md
- research/notes.md

### 開発コマンド

OpenAPI変更後:

    pnpm --filter @workspace/api-spec run codegen

API型チェック:

    pnpm --filter @workspace/api-server run typecheck

Web型チェック:

    pnpm --filter @workspace/home-navi run typecheck

Web全体にはシフト機能と無関係な既存型エラーがあります。今回変更したファイルに新規エラーがないかを切り分けてください。

### 現在の注意点

- シフト表は職員×日付で主に1件を表示する設計
- slotLabelは現在ほぼ空文字
- 夜勤の日跨ぎ判定は未実装
- 職員資格、希望休、公開状態のDB項目は未実装
- 必要人数はシフト種別単位で、曜日別・時間帯別ではない
- 前週コピーは表示対象の職員だけをコピーする
- コピー・一括設定は登録済み件数を表示して確認後に上書きする

作業開始時に、まず関連ファイルの現状とgit diffを確認し、上記内容と現在のコードが一致するか検証してください。コードを事実として優先してください。

---
