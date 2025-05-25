# Bento

対話でワークフローを作れる業務プラットフォーム。
「月末の経費精算フローを作りたい」と話しかけるだけで、AIがステップ構成を提案してそのまま運用に載せられる。

## なぜ作ったか

業務フロー管理ツールは世の中にたくさんあるけど、どれもGUIでポチポチ組み立てる前提。
非エンジニアにとってはそれすらハードルが高い。自然言語で要件を伝えるだけでフローが出来上がる方がいい。

Gemini 2.5 FlashのFunction Calling + MCP連携で、外部ツール（Slack, Google Sheets, freeeなど）とも繋がるようにした。

## 構成

```
bento/
├── web/          Next.js 16 (App Router) + shadcn/ui
├── api/          FastAPI + Firebase Admin SDK
├── functions/    Cloud Functions (自動集計用)
└── firebase/     Firestoreルール・インデックス
```

- **フロント**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **バックエンド**: FastAPI (Python 3.12), Gemini 2.5 Flash
- **データ**: Firestore（マルチテナント: `companies/{id}/...`）
- **認証**: Firebase Auth → IDトークンをAPIに送ってミドルウェアで検証
- **外部連携**: MCP SDK (SSE) + Composio経由でOAuth接続

## 主な機能

**AI対話ワークフロービルダー**
チャットでやりたいことを伝えると、ワークフローテンプレートを自動生成。
ステップタイプは承認・フォーム入力・自動集計・AI異常検知・条件分岐・Webhookなど10種類以上。

**MCP連携**
Composioのサービスカタログ経由でGoogle Sheets, Slack, Notion, Gmailなどに接続。
OAuth認証→ツール一覧取得→チャットから直接実行まで一気通貫。

**ダッシュボード**
完了率、メンバー別進捗、承認待ちを可視化。

**スケジュール実行**
APSchedulerでCron式の自動実行。人の操作が不要なステップは自動で進む。

## セットアップ

```bash
# API
cd api && cp .env.example .env
# .envにFirebase/Geminiの設定を記入、service-account.jsonを配置
pip install -r requirements.txt
uvicorn app.main:app --reload

# Web
cd web && cp .env.local.example .env.local
npm install && npm run dev
```

## AIプロバイダー

抽象化レイヤー（`api/app/services/ai/`）でモデルを差し替え可能。
`AIProvider`を実装して`registry.py`に登録、`.env`の`AI_PROVIDER`で切り替え。
現状はGemini実装のみだが、Claude/GPTへの拡張を想定した設計。
