# ShimeFlow（シメフロー）- 設計仕様書

## 概要
業務締め作業を自動化・一元管理するWebアプリ + モバイルアプリ。
従業員ごとにカスタマイズ可能なワークフローを定義し、データの自動集計→人間の確認→次工程への自動遷移を実現する。
PCでもスマホでも同じ作業ができる。

---

## コンセプト
**「人間は確認してOKを押すだけ」**

- 集計はバックグラウンドで自動実行済み
- URLを開くと数字がすでに入っている
- OKなら次の工程に自動で進む
- スマホでどこからでも締められる

---

## アーキテクチャ

```
┌──────────────────────────────────────────────────┐
│                管理者画面（Web）                    │
│  ワークフロー設計 / ユーザー管理 / テンプレート     │
└──────────────────────┬───────────────────────────┘
                       │
         ┌─────────────┼─────────────────┐
         ▼             ▼                 ▼
    Flutter Web    Flutter App     Cloud Functions
    (Web版)        (iOS/Android)   (自動集計エンジン)
         │             │                 │
         └─────────────┼─────────────────┘
                       ▼
              ┌─────────────────┐
              │   Firestore     │
              │ (ワークフロー   │
              │  定義+実行ログ) │
              └────────┬────────┘
                       │
           ┌───────────┼───────────────┐
           ▼           ▼               ▼
    Google Sheets   外部API         Gemini AI
     API v4        (freee等)      (異常値検知)
```

## 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| フロント（モバイル+Web） | Flutter | biz_sheet_appと同じ構成。Web/iOS/Android共通コード |
| バックエンド | FastAPI (Python) | biz_sheet_apiの構成を流用 |
| DB | Firebase Firestore | ユーザースコープ `companies/{cid}/users/{uid}/...` |
| 認証 | Firebase Auth | Google/Apple/メールパスワード |
| 自動集計 | Cloud Functions + Cloud Scheduler | cron式で日次/月次集計を裏で実行 |
| スプシ連携 | Google Sheets API v4 | 読み書き両対応。biz_sheet_appの実装を流用 |
| AI | Gemini 2.5 Flash | 異常値検知、集計要約、自動カテゴリ分類 |
| 通知 | FCM + メール | 締め開始通知、承認依頼、期限リマインド |
| デプロイ | Vercel (API/Web) + Firebase Hosting | |

---

## データモデル

### Company（会社）
```json
{
  "id": "company_xxx",
  "name": "株式会社〇〇",
  "plan": "standard",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### User（ユーザー）
```json
{
  "uid": "firebase_uid",
  "companyId": "company_xxx",
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "role": "member",          // "admin" | "manager" | "member"
  "department": "経理部",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### WorkflowTemplate（ワークフロー定義）
```json
{
  "id": "wf_monthly_close",
  "companyId": "company_xxx",
  "name": "経理・月次締め",
  "description": "月末の売上・経費確定作業",
  "schedule": {
    "type": "monthly",       // "daily" | "weekly" | "monthly" | "manual"
    "dayOfMonth": -1,        // -1 = 最終日
    "time": "09:00"
  },
  "assigneeIds": ["uid_tanaka"],
  "approverIds": ["uid_suzuki"],
  "steps": [
    {
      "id": "step_1",
      "order": 1,
      "type": "auto_aggregate",
      "label": "売上データ集計",
      "config": {
        "source": "google_sheets",
        "spreadsheetId": "xxx",
        "sheetName": "売上",
        "aggregation": "sum",
        "targetColumn": "D",
        "dateColumn": "A",
        "dateRange": "this_month"
      }
    },
    {
      "id": "step_2",
      "order": 2,
      "type": "confirm_url",
      "label": "売上スプシを確認",
      "config": {
        "url": "https://docs.google.com/spreadsheets/d/xxx",
        "description": "今月の売上合計が正しいか確認してください",
        "showAggregatedValue": true
      }
    },
    {
      "id": "step_3",
      "order": 3,
      "type": "confirm_url",
      "label": "freeeで仕訳確認",
      "config": {
        "url": "https://app.freee.co.jp/xxx",
        "description": "仕訳が正しく登録されているか確認"
      }
    },
    {
      "id": "step_4",
      "order": 4,
      "type": "input",
      "label": "備考入力",
      "config": {
        "fields": [
          {"key": "note", "label": "特記事項", "type": "text", "required": false}
        ]
      }
    },
    {
      "id": "step_5",
      "order": 5,
      "type": "approval",
      "label": "上司承認",
      "config": {
        "approverIds": ["uid_suzuki"],
        "autoNotify": true
      }
    }
  ],
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

### WorkflowExecution（実行インスタンス）
```json
{
  "id": "exec_2026_03",
  "templateId": "wf_monthly_close",
  "companyId": "company_xxx",
  "assigneeId": "uid_tanaka",
  "status": "in_progress",    // "pending" | "in_progress" | "completed" | "rejected"
  "currentStepId": "step_2",
  "startedAt": "2026-03-31T09:00:00Z",
  "completedAt": null,
  "steps": {
    "step_1": {
      "status": "completed",
      "result": {"aggregatedValue": 1250000},
      "completedAt": "2026-03-31T09:00:05Z",
      "completedBy": "system"
    },
    "step_2": {
      "status": "in_progress",
      "result": null,
      "completedAt": null,
      "completedBy": null
    }
  }
}
```

### AggregationJob（自動集計ジョブ）
```json
{
  "id": "job_xxx",
  "templateId": "wf_monthly_close",
  "stepId": "step_1",
  "schedule": "0 8 * * *",
  "lastRunAt": "2026-03-31T08:00:00Z",
  "lastResult": {
    "status": "success",
    "value": 1250000,
    "rowCount": 47
  }
}
```

---

## ステップタイプ

| type | 説明 | 人間の操作 |
|---|---|---|
| `auto_aggregate` | スプシ/DB/APIから自動集計 | なし（裏で完了） |
| `confirm_url` | URLを開いて目視確認 | OK or 差し戻し |
| `confirm_value` | 集計値を表示して確認 | OK or 修正 |
| `input` | テキスト/数値の入力 | フォーム入力 |
| `approval` | 上司/管理者の承認 | 承認 or 却下 |
| `webhook` | 外部APIに通知/データ送信 | なし（自動） |
| `ai_check` | AIが異常値を検知して報告 | 確認のみ |

---

## 画面構成

### 共通（Web/Mobile同一）

**1. ホーム（今日のやること）**
```
┌──────────────────────────┐
│  今日の締め作業            │
│                          │
│  ⏳ 経理・月次締め        │
│     Step 2/5 - 売上確認   │
│     [続きから →]          │
│                          │
│  ✅ 日次レジ締め          │
│     完了済み 10:30        │
│                          │
│  🔜 在庫棚卸             │
│     15:00開始予定         │
└──────────────────────────┘
```

**2. 締め実行画面**
```
┌──────────────────────────┐
│  経理・月次締め            │
│  Step 2/5                │
│                          │
│  ━━●━━━━━━ 40%          │
│                          │
│  📊 売上スプシを確認       │
│                          │
│  集計結果: ¥1,250,000     │
│  (前月比 +8.2%)          │
│                          │
│  ⚠️ AI: 3/15の売上が      │
│  通常の3倍です。確認を。   │
│                          │
│  [スプシを開く]           │
│                          │
│  [✅ OK] [❌ 差し戻し]    │
└──────────────────────────┘
```

**3. 管理者: ワークフロー設計**
```
┌──────────────────────────┐
│  ワークフロー設計          │
│                          │
│  名前: 経理・月次締め      │
│  担当: 田中太郎           │
│  スケジュール: 毎月末日 9時│
│                          │
│  ── ステップ ──           │
│  1. [自動集計] 売上集計    │
│  2. [URL確認] スプシ確認   │
│  3. [URL確認] freee確認    │
│  4. [入力] 備考           │
│  5. [承認] 上司承認        │
│                          │
│  [+ ステップ追加]         │
│  [テンプレートとして保存]  │
└──────────────────────────┘
```

**4. ダッシュボード**
```
┌──────────────────────────┐
│  締め状況ダッシュボード     │
│                          │
│  今月: 12/15 完了 (80%)   │
│  ━━━━━━━━━━━━━━━━━━ 80%  │
│                          │
│  遅延中: 2件              │
│  承認待ち: 1件            │
│                          │
│  部門別進捗               │
│  経理  ━━━━━━━━━━ 100%   │
│  営業  ━━━━━━━━━━ 100%   │
│  物流  ━━━━━━━━━─── 60%  │
└──────────────────────────┘
```

---

## AI活用ポイント

| 機能 | 内容 |
|---|---|
| 異常値検知 | 集計値が前月比で大きく乖離していたら警告 |
| 集計要約 | 「今月は売上が前月比+8%、経費は横ばい」 |
| 自動分類 | 経費の勘定科目を自動判定 |
| ワークフロー提案 | 「この業種ならこのテンプレートがおすすめ」 |
| 自然言語で設計 | 「毎月末に売上集計して上司に承認もらう」→ワークフロー自動生成 |

---

## 自動集計エンジン（Cloud Functions）

```
Cloud Scheduler (cron)
    │
    ▼
Cloud Function: runAggregationJobs()
    │
    ├─ Google Sheets API → スプシからデータ取得
    ├─ 外部API (freee等) → 会計データ取得
    ├─ Firestore → 社内データ集計
    │
    ▼
Firestore に結果を保存
    │
    ▼
ワークフローの auto_aggregate ステップを自動完了
    │
    ▼
次のステップ（人間の確認）に進む
    │
    ▼
FCM プッシュ通知: 「締め作業の準備ができました」
```

---

## Firestoreデータ構造

```
companies/
  {companyId}/
    info/                          # 会社情報
    users/
      {uid}/                       # ユーザー情報
    workflow_templates/
      {templateId}/                # ワークフロー定義
    workflow_executions/
      {executionId}/               # 実行インスタンス
    aggregation_jobs/
      {jobId}/                     # 自動集計ジョブ定義・結果
    activity_logs/
      {logId}/                     # 操作ログ（誰がいつ何をOKしたか）
```

---

## API エンドポイント（FastAPI）

```
# 認証
POST   /api/auth/login

# ワークフローテンプレート
GET    /api/workflows                    # 一覧
POST   /api/workflows                    # 作成
GET    /api/workflows/{id}               # 詳細
PUT    /api/workflows/{id}               # 更新
DELETE /api/workflows/{id}               # 削除

# ワークフロー実行
GET    /api/executions                   # 自分の実行一覧
GET    /api/executions/today             # 今日のやること
GET    /api/executions/{id}              # 実行詳細
POST   /api/executions/{id}/steps/{stepId}/complete   # ステップ完了
POST   /api/executions/{id}/steps/{stepId}/reject     # 差し戻し
POST   /api/executions/{id}/steps/{stepId}/approve    # 承認

# 集計
GET    /api/aggregations/{jobId}/result  # 集計結果取得
POST   /api/aggregations/{jobId}/run     # 手動実行

# ダッシュボード
GET    /api/dashboard                    # 締め状況サマリー
GET    /api/dashboard/department          # 部門別進捗

# AI
POST   /api/ai/check                     # 異常値チェック
POST   /api/ai/suggest-workflow           # ワークフロー提案

# 管理者
GET    /api/admin/users                   # ユーザー管理
POST   /api/admin/users/invite            # 招待
GET    /api/admin/logs                    # 操作ログ
```

---

## biz_sheetからの流用

| biz_sheetの資産 | ShimeFlowでの活用 |
|---|---|
| Flutter Riverpod構成 | そのまま流用 |
| Firebase Auth (Google/Apple) | そのまま流用 |
| Google Sheets API連携 | 集計エンジンの中核 |
| FastAPI + Firestore CRUD | APIの基盤 |
| Next.js管理画面 | 管理者画面のベース |
| Gemini AI統合 | 異常値検知・集計要約 |
| Vercelデプロイ構成 | そのまま流用 |

---

## MVP スコープ（Phase 1）

1. ワークフロー定義（管理者がWebで作成）
2. ステップ: `confirm_url` + `approval` のみ
3. スマホ/Webで締め実行（OK→次へ）
4. プッシュ通知
5. 1社向けカスタム

## Phase 2
- `auto_aggregate`（スプシ自動集計）
- AI異常値検知
- ダッシュボード
- テンプレートライブラリ

## Phase 3
- マルチテナント（SaaS化）
- 外部API連携（freee, マネーフォワード等）
- 自然言語ワークフロー生成
- 監査ログ・コンプライアンス対応

---

## 想定料金

| プラン | 月額 | 内容 |
|---|---|---|
| スターター | ¥5,000 | 5ユーザー、10ワークフロー |
| スタンダード | ¥15,000 | 20ユーザー、無制限ワークフロー、AI機能 |
| エンタープライズ | ¥50,000〜 | 無制限、API連携、専任サポート |

---

## 最終構想: 個人向け汎用業務アプリプラットフォーム

### ビジョン
ShimeFlowは最終的に **「非エンジニアが対話だけで自分専用の業務アプリを作れるプラットフォーム」** を目指す。
業界不問（建築・不動産・経理etc）、個人が自分の業務に必要なものを自分で作れる世界。

### 現状の課題
- Claude Code / Cursor で「自分専用ツール」を作ること自体は既に可能
- しかしターミナル・コードが丸見え → 非エンジニアには拒絶反応が起きる
- この **「AIのコード生成力」と「消費者向けUX」のギャップ** を埋める

### アプローチ
1. **汎用OSキット（ベースアプリ）** を1つ用意する
2. ユーザーは **対話形式** で自分の業務を説明する
3. AIがユーザーの既存業務環境（使用中のサービス、URL、フロー）を会話から吸い上げる
4. 裏側でAIがベースアプリを **その人専用にカスタマイズ** する
5. ユーザーにはコードもターミナルも一切見えない

### 具体例
経理の人が「freee使ってて、売上はこのスプシで管理してて、月末に上司に報告してる」と伝えると：
- freeeのURL/API連携を自動で組み込む
- 該当スプシを集計対象に設定する
- 承認フローに上司を入れる
→ 全て裏側で完了し、その人専用の業務アプリとして即利用可能に

### アーキテクチャ方針: サーバーサイド完結型
- スマホアプリは **汎用ビューワー/実行エンジン** として固定（Notionと同じ思想）
- カスタマイズはFirestoreのワークフロー定義（JSON）で表現される
- AIが変えるのはデータのみ → **アプリ自体のアップデート不要**
- ストア審査は汎用シェル1回のみ。各ユーザーのカスタマイズはデータなので審査不要
- ShimeFlowの `steps[]` 配列がそのままビルディングブロック（パーツ）になる

### スマホ配布戦略
| 方式 | ストア審査 | 備考 |
|---|---|---|
| ストア公開（汎用シェル） | 1回のみ | 個別カスタマイズはデータで行うため追加審査なし |
| PWA | 不要 | ホーム画面追加のみ。プッシュ通知も対応 |
| Android APK直配布 | 不要 | 個人利用・少人数配布向け |
| iOS TestFlight | 不要（90日制限） | テスト・少人数配布向け |

### ShimeFlowとの関係
- ShimeFlowのMVPで **パーツの精度と実用性** を「締め作業」ドメインで証明する
- その後、ワークフロー設計画面を **対話AIレイヤー** に置き換えることで自然に汎用化
- Phase 1〜3は変わらず、この構想は **Phase 4以降** の拡張として位置づけ
