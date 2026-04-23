# Home-Navi ウェブアプリ要件定義書

## アプリ概要

介護施設向けの入居者管理・ケア記録システム。現在はAppSheetで運用されており、ウェブアプリとして再構築・ブラッシュアップする。

アプリ名: **Home-Navi**

---

## 主要機能モジュール（スクリーンショット解析より）

### 1. 利用者一覧（Resident List）

- 入居者の一覧表示
- 表示項目：
  - 部屋番号
  - 顔写真
  - 利用者名（漢字 + ふりがな）
  - 年齢
  - 申し送り有無アイコン
- 検索機能（名前で検索）
- フィルター・ソート機能
- クリックで詳細表示

---

### 2. 利用者情報（Resident Profile）

各入居者の詳細プロフィール：

#### 基本情報
- 部屋番号
- 利用者名（漢字）
- Name（ローマ字）
- 性別
- 生年月日・年齢・介護度
- 排泄管理（有/無）
- どんな人物（自由記述・入居日など）
- 表示/非表示フラグ

#### 医療情報
- 往診クリニック（CL-1, CL-2）
- 既往歴（複数）
- Dr.の指示

#### キーパーソン情報
- キーパーソン名・続柄
- キーパーソンMEMO
- キーパーソン住所
- キーパーソンTEL（複数）

#### ケアマネ情報
- ケアマネ事業者名
- 担当ケアマネ名

#### 保険情報
- 保険一覧（別テーブル、追加可能）

---

### 3. 申し送り（Shift Handover Notes）

スタッフ間の引き継ぎ・報告ノート。

#### 一覧表示
- 日時（降順）
- 利用者名（または「その他」）
- 内容プレビュー
- 重要フラグ（色分け表示）

#### 詳細表示
- 入力日時
- 利用者名
- 申し送り本文
- 入力者名
- 写真（最大5枚）

#### 入力フォーム
- 入力日時（デフォルト: 現在日時）
- 分類: 利用者 / その他
- 重要フラグ（重要）
- 申し送り内容（テキスト）
- 入力者（スタッフ選択）
- 写真1〜5（カメラ/ファイル）

---

### 4. サービス（Services）

- 利用者ごとのサービス記録
- 申し送りと連携（サービス内容の引き継ぎ）
- 入居者プロフィールと連動して表示

---

### 5. 食事（Meals）

#### 一覧表示
- 利用者ごとに最新の食事区分アイコンを表示（朝食/昼食/夕食）

#### 詳細（入居者別）
食事記録の一覧（時系列）：
- 日時
- 食事区分（朝食 / 昼食 / 夕食）
- 食事摂取量（例: 食 5-0〜10-10）
- 水分摂取量（水 mL）
- 栄養摂取率（%）
- 服薬OK フラグ

#### 記録フォーム
- 日時
- 食事区分
- 摂取量
- 水分量
- 栄養率
- 服薬確認

---

### 6. バイタル（Vital Signs）

#### 一覧表示
- 利用者ごとに最新のバイタル値を表示
- グルーピング：
  - 「再測定」（要注意・アラート付き）
  - 「OK」（正常範囲）
- バイタル値：KT（体温）・BP（血圧）・P（脈拍）・S（SpO2）

#### 詳細（入居者別）
バイタル記録の一覧（時系列）：
- 日時
- 体温（KT）
- 血圧（BP: 収縮期/拡張期）
- 脈拍（P）
- SpO2（S）
- 入浴フラグ
- 備考

#### アラート機能
- 正常範囲外の値は警告アイコン（⚠️）で表示
- 再測定が必要な利用者を上部にまとめて表示

---

### 7. 体重（Weight）

#### 一覧表示
- 利用者ごとに最新の体重を表示（kg）
- 体重変化が大きい場合はアラート色

#### 詳細（入居者別）
体重記録の一覧（時系列）：
- 日時
- 体重（kg）
- 写真（任意）
- 備考（計画、次回測定日、出品先など）

---

### 8. 排泄（Elimination/Excretion）

#### 一覧表示（介助管理ビュー）
- 「介助してください」グループ（最終記録から日数が多い入居者）
- 「OK」グループ
- 各入居者：最終記録からの日数（マイナス数字で表示）
- 排泄タイプアイコン

#### 詳細（入居者別）
記録の一覧（時系列）：
- 日時
- 種類（尿 / 便 / 入浴時など）
- 量（多 / 中 / 少）

#### 記録フォーム
- RESET ボタン（記録リセット用）
- 記録完了後にリセット

---

### 9. デイ準備物（Day Service Preparation）

デイサービス利用者向けの持参物チェックリスト：
- 利用者名
- デイ施設名
- デイ利用曜日
- デイ持参物リスト（箇条書き）

---

### 10. 健康管理（Health Management）

複合ビュー：担当クリニックでグルーピングされた入居者の健康総括画面。

左ペイン：
- クリニック別入居者リスト

中央ペイン（入居者基本情報）：
- 部屋番号・氏名・生年月日・年齢・性別・介護度
- 往診クリニック
- 既往歴
- Dr.の指示（テキスト入力）

右ペイン（関連記録）：
- 申し送り（Dr.報告）タブ
  - 日時・内容・写真付き
- バイタル/入浴記録
  - 時系列リスト
- 体重記録
  - 時系列リスト
- 食事・水分・服薬記録
  - 時系列リスト（朝/昼/夕・摂取量・水分・服薬OK）
- 排泄記録
  - 時系列リスト

---

### 11. 利用者登録（Resident Registration）

新規入居者登録フォーム：
- 部屋番号（必須）
- 利用者名 姓・名
- ふりがな 姓・名
- ローマ字 姓・名
- 性別：男性 / 女性（トグルボタン）
- 生年月日：
  - 元号選択: 大正 / 昭和 / 平成（トグルボタン）
  - 年・月・日（数値入力）
- 介護度：支1 / 支2 / 介1 / 介2 / 介3 / 介4 / 介5 / 新規申請中 / 区分変更中（トグルボタン）
- 排泄管理：有 / 無（トグルボタン）
- 表示/非表示：表示 / 非表示（トグルボタン）

---

### 12. 職員一覧（Staff Management）

スタッフ管理画面：

#### 一覧表示
- 氏名（漢字）
- ふりがな
- 電話番号
- 表示/非表示グルーピング（表示中スタッフを上部に）
- 電話発信・メッセージアイコン

#### 詳細表示
- 従業員名
- ふりがな
- 緊急連絡先（TEL）
- 表示/非表示

#### 登録フォーム
- 従業員名 姓・名
- ふりがな 姓・名
- 緊急連絡先TEL
- 表示/非表示

---

### 13. バイタル一覧PDF（Vital Signs PDF Export）

クリニック別にバイタルデータをPDF出力する機能：
- クリニック名を選択（ドロップダウン）
- 「バイタルPDF 作成」ボタン
- 生成されたPDFファイルのリンク表示（ファイル名に日付入り）

#### PDFの内容
- ヘッダー: 施設名_利用者バイタル一覧 / クリニック名 / 日付
- テーブル: 利用者名 / 体温 / 血圧 / 脈 / SpO2

---

### 14. 入浴報告（Bathing Report）

入浴記録と介助記録を管理する専用モジュール：

#### 一覧表示
- 日付グループ（降順）
- 各レコード: 部屋番号・利用者名・担当スタッフ名
- 「本日のバイタル」ビュー（右ペイン）

#### 詳細表示
- 記入日
- 利用者名（部屋番号 + 氏名）
- 入浴記録：
  - KT / BP / P / S（バイタル値）
  - 入浴メモ（自由記述 例: 「個浴にて入浴を行う」）
- 入浴介助者（担当スタッフ名）
- 申し送りボタン（申し送りへリンク）

#### 入力フォーム
- 記入日
- 利用者選択
- バイタル値（KT / BP / P / S）
- 入浴メモ
- 入浴介助者（スタッフ選択）

---

## データモデル（仮）

### residents（利用者）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| room_number | string | 部屋番号 |
| last_name | string | 姓（漢字） |
| first_name | string | 名（漢字） |
| last_name_kana | string | 姓（ふりがな） |
| first_name_kana | string | 名（ふりがな） |
| last_name_roman | string | 姓（ローマ字） |
| first_name_roman | string | 名（ローマ字） |
| gender | enum | 男性/女性 |
| birth_date | date | 生年月日 |
| care_level | integer | 介護度（1〜5） |
| stoma_management | boolean | 排泄管理の有無 |
| photo_url | string | 顔写真URL |
| move_in_date | date | 入居日 |
| notes | text | どんな人物（自由記述） |
| clinic_1 | string | 往診CL-1 |
| clinic_2 | string | 往診CL-2 |
| medical_history | text | 既往歴 |
| doctor_instructions | text | Dr.の指示 |
| key_person_name | string | キーパーソン名 |
| key_person_relation | string | 続柄 |
| key_person_memo | text | キーパーソンMEMO |
| key_person_address | string | キーパーソン住所 |
| key_person_tel_1 | string | キーパーソンTEL1 |
| care_manager_company | string | ケアマネ事業者名 |
| care_manager_name | string | 担当ケアマネ |
| is_visible | boolean | 表示/非表示 |

### handover_notes（申し送り）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID（NULLの場合は「その他」） |
| recorded_at | datetime | 入力日時 |
| category | enum | 利用者/その他 |
| is_important | boolean | 重要フラグ |
| content | text | 申し送り内容 |
| author | string | 入力者 |
| photo_1_url〜photo_5_url | string | 写真URL |

### vitals（バイタル）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| recorded_at | datetime | 記録日時 |
| temperature | decimal | 体温（KT） |
| bp_systolic | integer | 血圧（収縮期） |
| bp_diastolic | integer | 血圧（拡張期） |
| pulse | integer | 脈拍（P） |
| spo2 | integer | SpO2（S） |
| is_bath | boolean | 入浴フラグ |
| notes | text | 備考 |

### meals（食事）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| recorded_at | datetime | 記録日時 |
| meal_type | enum | 朝食/昼食/夕食 |
| food_intake | string | 摂取量（例: 5-5） |
| water_ml | integer | 水分量(mL) |
| nutrition_percent | integer | 栄養率(%) |
| medication_ok | boolean | 服薬OK |

### weights（体重）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| recorded_at | datetime | 記録日時 |
| weight_kg | decimal | 体重（kg） |
| photo_url | string | 写真URL |
| notes | text | 備考 |

### eliminations（排泄）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| recorded_at | datetime | 記録日時 |
| type | enum | 尿/便/入浴時 |
| amount | enum | 多/中/少/無 |
| notes | text | 備考 |

### day_services（デイサービス）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| facility_name | string | デイ施設名 |
| usage_days | string | 利用曜日 |
| items_to_bring | text | 持参物リスト |

### insurances（保険）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| insurance_type | string | 保険種別 |
| insurance_number | string | 保険番号 |
| valid_from | date | 有効開始日 |
| valid_until | date | 有効終了日 |

### staff（職員）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| last_name | string | 姓（漢字） |
| first_name | string | 名（漢字） |
| last_name_kana | string | 姓（ふりがな） |
| first_name_kana | string | 名（ふりがな） |
| tel | string | 緊急連絡先TEL |
| is_visible | boolean | 表示/非表示 |

### bath_reports（入浴報告）
| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| resident_id | UUID | 利用者ID |
| staff_id | UUID | 入浴介助者ID |
| recorded_at | datetime | 記入日 |
| temperature | decimal | 体温（KT） |
| bp_systolic | integer | 血圧（収縮期） |
| bp_diastolic | integer | 血圧（拡張期） |
| pulse | integer | 脈拍（P） |
| spo2 | integer | SpO2（S） |
| bath_memo | text | 入浴メモ（自由記述） |

---

## ナビゲーション構成（サイドバー）

スクリーンショットのサイドバーアイコン確認済み：
1. 申し送り
2. バイタル
3. 食事
4. 排泄
5. 体重
6. サービス
7. デイ
8. 健康管理
9. 入浴報告
10. 利用者一覧
11. 利用者登録
12. 職員一覧
13. バイタルPDF出力
14. 設定・その他

---

## 追加予定の新機能

（今後ユーザーより追加情報を受領）

---

## 技術スタック（予定）

- フロントエンド: React + Vite
- バックエンド: Express (Node.js)
- データベース: PostgreSQL + Drizzle ORM
- 認証: 要検討
- 画像保存: オブジェクトストレージ

---

## 参考スクリーンショット

添付された AppSheet アプリのスクリーンショット（2026年4月時点）：
- `image_1776950990665.png` — 利用者一覧
- `image_1776951018063.png` — 利用者情報詳細
- `image_1776951038364.png` — 申し送り一覧
- `image_1776951059545.png` — 申し送り入力フォーム
- `image_1776951081357.png` — サービス詳細
- `image_1776951112068.png` — 食事記録
- `image_1776951157105.png` — バイタル一覧
- `image_1776951173531.png` — 体重一覧
- `image_1776951191125.png` — 体重入力フォーム
- `image_1776951220496.png` — デイ準備物
- `image_1776951244069.png` — 排泄詳細
- `image_1776951310365.png` — 排泄介助管理
- `image_1776951324625.png` — 利用者情報（スクロール）
- `image_1776951342105.png` — 利用者情報（スクロール続き）
- `image_1776951367866.png` — 健康管理
- `image_1776951380180.png` — 健康管理（スクロール）
- `image_1776951392790.png` — 健康管理（Dr.報告付き）
- `image_1776951411010.png` — 健康管理（Dr.報告写真付き）
- `image_1776951427005.png` — 利用者登録一覧
- `image_1776951427005.png` — 利用者登録フォーム（上部）
- `image_1776951502362.png` — 利用者登録フォーム（生年月日・介護度・排泄管理）
- `image_1776951519995.png` — 職員一覧・詳細
- `image_1776951535572.png` — バイタルPDF出力画面
- `image_1776951551556.png` — バイタルPDFの内容
- `image_1776951568797.png` — 入浴報告一覧・詳細
- `image_1776951584917.png` — 入浴報告詳細（同上）
