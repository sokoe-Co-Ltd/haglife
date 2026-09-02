# Home-Navi シフト表機能改善調査レポート

## 1. 要約
本レポートは、介護施設向け管理アプリ「Home-Navi」のシフト表機能改善に向け、主要SaaS、介護特化製品、およびグローバルなスケジュールUXの知見をまとめたものです。成功の鍵は、法令等のハード制約と現場の希望・公平性というソフト制約を分離管理し、「収集→作成→調整→公開」のタスク順UXを設計することにあります。

## 2. 競合比較表
| 製品 | 優れたUIUX | データ処理・制約 | 参考になる点 |
| :--- | :--- | :--- | :--- |
| Airシフト | 一続きのタスクフロー | 自動反映、人件費概算表示 | 収集から共有までの導線 [L8] |
| シフオプ | リアルタイム警告表示 | 独自労務規定、権限管理 | 警告の可視化と権限設計 [L9] |
| ジョブカン | 2種類の専用シフト画面 | パレット/ラインシフト | 目的別シフト入力画面 [L10] |
| KOT | 重ね合わせ比較 | 権限・承認フロー詳細化 | 希望と確定の視覚的比較 [L11] |
| 働き方マイスター | 介護要件の自動表示 | 72時間要件、部門間応援 | 介護特有の配置予測 [L42] |

## 3. 業界で共通する優れたUIUXパターン
* **二層データ表示**: `希望`と`確定`を別状態で保持し、同一グリッド上で色分けやラベルで区別する [L16, L46]。
* **日別充足パネル**: 必要人数・配置済み人数・不足数を時間帯や役割別に常時表示 [L15, L47]。
* **調整導線の一元化**: 不足セルから直接ヘルプ募集を行い、往復の手間を省く [L18, L75]。
* **公開前プレビュー**: 編集保存とスタッフ公開を分け、プレビューを経て通知する [L19, L76]。

## 4. バックエンド・データ処理の設計パターン
* **制約管理**: 法令、施設方針、個人希望を分類し、それぞれに重み（Weight）を設定して計算する [L95, L102]。
* **イベントログ**: 監査要件として、状態変更を順序付きイベントログとして保存する [L130, L139]。
* **排他制御**: PostgreSQLのRange型とGISTインデックスを用い、物理的な重複をDB制約で拒否する [L127]。
* **楽観更新**: WebSocketとRedux action（version付与）を用いたリアルタイム反映とロールバック機構 [L129, L137]。

## 5. エンジニア発信から得られる技術知見
* **ソルバー活用**: OR-Tools CP-SATを用い、ハード制約（法令等）とソフト制約（公平性等）を分離して最適解を探索する [L94, L95]。
* **説明可能性**: 実行不能時に`sufficient_assumptions_for_infeasibility()`を用いて、なぜ解がないかをユーザーへ自然言語的に伝える工夫が可能 [L97, L105]。
* **増分更新**: 全再計算ではなく、前回解を`add_hint()`として与え、変更差分を最小化する設計が実用度が高い [L99]。

## 6. Home-Naviへの推奨ロードマップ
* **P0（基盤強化）**: 二層データ構造の導入（希望/確定）、基本的な法令アラート機能、重複防止DB制約の構築 [L16, L39, L127]。
* **P1（UX改善）**: 日別充足パネルの導入、シフト公開前プレビュー機能、役割・権限管理の実装 [L11, L21, L47]。
* **P2（高度化）**: ソルバーを用いた自動編成エンジン、部門間応援機能、変更履歴の監査ログUIの実装 [L42, L51, L139]。

## 7. 注意点
* **過度な自動化の回避**: 介護現場では公平性の説明責任が重要であるため、完全自動化より管理者が重みを調整できる「支援型」が望ましい [L51]。
* **警告と禁止の分離**: 労働基準法違反（禁止）と院内の方針（警告）は色やメッセージで厳格に区別すること [L20, L40]。
* **タイムゾーン・DST**: 予定変更時は壁時計時刻＋IANA zoneを正とし、暦上のずれを防ぐ [L134]。

## 8. 参考情報（15件）
※提供されたコンテンツ内のURLを抜粋。
1. Airシフト: https://airregi.jp/shift [L28]
2. シフオプ: https://www.shifop.jp/function/ [L29]
3. ジョブカン: https://jobcan.ne.jp/function/154 [L30]
4. KOT店舗管理: https://www.kingoftime.jp/problem/store-management [L31]
5. KOT権限設定: https://support.ta.kingoftime.jp/hc/ja/articles/4419416241433 [L32]
6. 勤革時: https://jpn.nec.com/king-of-time/main_function.html [L33]
7. JNA夜勤ガイドライン: https://www.nurse.or.jp/nursing/shuroanzen/yakinkotai/index.html [L54]
8. 厚労省労働時間: https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/roudouzikan/index.html [L55]
9. 厚労省夜勤告示: https://www.mhlw.go.jp/web/t_doc?dataId=82aa0263 [L56]
10. Shiftmation: https://shiftmation.com/spec/ [L58]
11. oplus FAQ: https://opluswork.com/faqhp [L59]
12. Deputy: https://www.deputy.com/features/auto-scheduling [L84]
13. Google OR-Tools: https://developers.google.com/optimization/scheduling/employee_scheduling [L110]
14. Optibus Engineering: https://blog.optibus.com/how-im-making-our-calendar-collaborative-in-real-time-with-redux-and-operational-transformation [L145]
15. Linear Sync Engine: https://linear.app/blog/scaling-the-linear-sync-engine [L147]