# TimeTracker Server

従業員の作業時間を記録し、プロジェクト別に仕分けて資産化工数を算出するためのサーバーアプリケーション。

## 機能

- デスクトップエージェントからアクティビティデータを受信
- プロジェクト別の工数仕分け
- 同じアプリ/ドメインの自動仕分けルール
- 月次工数集計のExcelエクスポート
- SAML認証対応（準備済み）
- 部署単位でのデータ管理（将来対応）

## セットアップ

### 必要要件

- Node.js 18以上
- npm

### インストール

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env

# データベースの初期化
npx prisma migrate dev

# 開発サーバーの起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 使い方

### 1. プロジェクトの作成

1. サイドバーから「プロジェクト」を選択
2. プロジェクトコード、名前を入力
3. 資産計上対象の場合は「資産計上対象」にチェック
4. 「プロジェクト作成」をクリック

### 2. エージェントからのデータ受信

デスクトップエージェントが以下のAPIにデータを送信:

```bash
POST /api/upload
Content-Type: application/json

{
  "user_id": "user@example.com",
  "date": "2024-01-15",
  "min_duration_seconds": 600,
  "app_summaries": [
    {
      "process_name": "code.exe",
      "total_seconds": 7200
    },
    {
      "process_name": "chrome.exe",
      "domain": "github.com",
      "total_seconds": 3600
    }
  ],
  "machine_name": "DESKTOP-001"
}
```

### 3. 時間記録の仕分け

1. サイドバーから「仕分け」を選択
2. 未仕分けの記録が一覧表示される
3. 各記録に対してプロジェクトを選択
4. 「自動適用」にチェックすると、同じアプリ/ドメインは次回から自動で同じプロジェクトに割り当て
5. 「割当」をクリック

### 4. Excelエクスポート

1. サイドバーから「エクスポート」を選択
2. 対象月を選択
3. 「Excelダウンロード」をクリック

出力フォーマット:

| 日付 | プロジェクト1（資産） | プロジェクト2 | ... |
|------|----------------------|---------------|-----|
| 8/1  | 5.5                  | 2.0           | ... |
| 8/2  | 4.0                  | 3.5           | ... |
| 合計 | 9.5                  | 5.5           | ... |

- 数値は時間（h）単位
- 資産計上対象プロジェクトは黄色でハイライト

## API リファレンス

### POST /api/upload

エージェントからのデータ受信エンドポイント。

**リクエスト:**
```json
{
  "user_id": "string (必須)",
  "date": "YYYY-MM-DD (必須)",
  "min_duration_seconds": "number (必須)",
  "app_summaries": [
    {
      "process_name": "string (必須)",
      "total_seconds": "number (必須)",
      "domain": "string (任意、ブラウザの場合)"
    }
  ],
  "machine_name": "string (任意)"
}
```

**レスポンス:**
```json
{
  "success": true,
  "message": "Received 5 records for user@example.com on 2024-01-15"
}
```

### GET /api/projects

プロジェクト一覧を取得。

### POST /api/projects

新規プロジェクトを作成。

```json
{
  "name": "新規システム開発",
  "code": "PRJ001",
  "description": "説明（任意）",
  "isCapex": true
}
```

### GET /api/time-records

時間記録を取得。

**クエリパラメータ:**
- `date`: 日付でフィルタ（YYYY-MM-DD）
- `userId`: ユーザーIDでフィルタ
- `unallocatedOnly`: `true`で未仕分けのみ

### POST /api/allocations

時間記録をプロジェクトに割り当て。

```json
{
  "timeRecordId": "record-id",
  "projectId": "project-id",
  "seconds": 3600,
  "saveAsRule": true
}
```

### GET /api/export

Excelファイルをダウンロード。

**クエリパラメータ:**
- `month`: 対象月（YYYY-MM、必須）
- `userId`: ユーザーIDでフィルタ（任意）

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| DATABASE_URL | データベース接続URL | file:./dev.db |
| AUTH_SECRET | NextAuth用シークレット | - |
| AUTH_URL | アプリケーションURL | http://localhost:3000 |

## データベーススキーマ

```
Department (部署)
├── id, name, createdAt, updatedAt

User (ユーザー)
├── id, email, name, departmentId, role
└── role: member / manager / admin

Project (プロジェクト)
├── id, name, code, description
├── isCapex (資産計上対象フラグ)
└── isActive

TimeRecord (時間記録)
├── id, userId, date, processName, domain
├── totalSeconds, machineName
└── unique: [userId, date, processName, domain]

TimeAllocation (仕分け結果)
├── id, userId, timeRecordId, projectId
├── seconds, isAutomatic
└── 1つのTimeRecordに対して複数の割り当て可能

AllocationRule (自動仕分けルール)
├── id, userId, processName, domain, projectId
└── unique: [userId, processName, domain]
```

## 本番環境へのデプロイ

### データベースの変更

本番環境ではPostgreSQLを推奨:

1. `prisma/schema.prisma`の`provider`を`postgresql`に変更
2. `DATABASE_URL`を PostgreSQL の接続文字列に設定
3. `npx prisma migrate deploy`を実行

### SAML認証の設定

`.env`に以下を追加:

```
SAML_IDP_METADATA_URL=https://your-idp/metadata
SAML_ENTITY_ID=your-entity-id
```

`src/lib/auth.ts`でSAMLプロバイダーを有効化。

## 開発

```bash
# 開発サーバー
npm run dev

# ビルド
npm run build

# 本番起動
npm start

# Prisma Studio（DBビューア）
npx prisma studio
```

## ライセンス

MIT
