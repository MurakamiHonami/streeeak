# Streeeak

Streeeak は、長期目標を月次/週次/日次に分解し、日々の達成を継続可視化する Web アプリです。

## 技術スタック

- Frontend: React + TypeScript + Vite + TanStack Query
- Backend: FastAPI + SQLAlchemy 2.0 + Pydantic
- DB: Supabase (PostgreSQL)
- Deploy 想定: Vercel (frontend) / Render (backend)

## ディレクトリ構成

- `frontend`: 画面実装
- `backend`: API / DBモデル / 業務ロジック

## 起動方法

### 0) 前提

- PostgreSQL がローカルで起動していること
- データベース `streeeak` が作成済みであること

例:

```bash
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb streeeak
```

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

`backend/.env` の主な設定:

```env
DATABASE_URL=postgresql+psycopg://<user>@localhost:5432/streeeak
GEMINI_API_KEY=<your_api_key>
GEMINI_MODEL=gemini-2.0-flash
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

必要に応じて `frontend/.env` を作成して以下を設定:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_DEFAULT_USER_ID=1
```

ブラウザ:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`

## データベース設計

現在は `backend/app/models` のSQLAlchemyモデルを元に、起動時にテーブル生成されます。

### テーブル一覧（概要）

- `users`
  - `id`, `email`, `name`, `password_hash`, `created_at`, `updated_at`
- `user_settings`
  - `user_id`, `auto_post_time`
- `goals`
  - `id`, `user_id`, `title`, `deadline`, `created_at`, `updated_at`
- `tasks`
  - `id`, `goal_id`, `user_id`, `type(monthly|weekly|daily)`, `title`
  - `month`, `week_number`, `date`, `is_done`, `carried_over`
  - `tags`, `note`, `created_at`, `updated_at`
- `posts`
  - `id`, `user_id`, `group_id`, `date`, `week_number`, `comment`, `achieved`, `created_at`
- `friendships`
  - `id`, `user_id`, `friend_id`, `created_at`
- `groups`
  - `id`, `name`, `owner_id`, `created_at`
- `group_members`
  - `id`, `group_id`, `user_id`, `created_at`

### 設計補足

- 長期目標は `goals` に保存
- ブレイクダウン結果（月次/週次/日次）は `tasks` に保存
- 日次タスクの詳細TODOは `tasks.note` に保存
- 日次未達成の持ち越しは `POST /tasks/:id/carry-over` で複製作成

## CRUD設計 / API設計

ベースURL: `http://127.0.0.1:8000`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

### Users

- `POST /users` ユーザー作成
- `GET /users/{user_id}` ユーザー取得
- `PUT /users/{user_id}` ユーザー更新
- `DELETE /users/{user_id}` ユーザー削除

### Goals

- `POST /goals` 長期目標作成
- `GET /goals?user_id=` 長期目標一覧
- `GET /goals/{goal_id}` 長期目標詳細
- `PUT /goals/{goal_id}` 長期目標更新
- `DELETE /goals/{goal_id}` 長期目標削除

### Tasks

- `POST /goals/{goal_id}/tasks/breakdown`
  - Geminiで分解（12ヶ月→直近1ヶ月週次→直近1週間日次）
  - `persist=true` で `tasks` へ保存
- `POST /tasks` タスク単体作成
- `POST /tasks/bulk` タスク一括作成
- `GET /tasks?user_id=&type=monthly&month=`
- `GET /tasks?user_id=&type=weekly&week_number=`
- `GET /tasks?user_id=&type=daily&date=`
- `PUT /tasks/{task_id}` タスク更新
- `PATCH /tasks/{task_id}/done` 完了切替
- `POST /tasks/{task_id}/carry-over` 翌日へ持ち越し
- `DELETE /tasks/{task_id}` タスク削除

### Posts

- `POST /posts` 投稿作成
- `GET /posts?user_id=&week=` フィード取得（本人＋フレンド）
- `GET /posts?group_id=&week=` グループ絞り込み
- `PUT /posts/{post_id}` 投稿更新
- `DELETE /posts/{post_id}` 投稿削除

### Friendships

- `POST /friendships` フレンド追加
- `GET /friendships?user_id=` フレンド一覧
- `DELETE /friendships/{friendship_id}` フレンド解除

### Groups / Members

- `POST /groups`
- `GET /groups?user_id=`
- `GET /groups/{group_id}`
- `PUT /groups/{group_id}`
- `DELETE /groups/{group_id}`
- `POST /groups/{group_id}/members`
- `GET /groups/{group_id}/members`
- `DELETE /groups/{group_id}/members/{user_id}`

### Analytics

- `GET /analytics/ranking?user_id=&week=&top_n=3`
  - 週次達成率の平均でTOP Nを返却

## 画面と主API対応

- ホーム
  - `GET /tasks?type=daily&date=today`
  - `PATCH /tasks/:id/done`
  - `POST /tasks/:id/carry-over`
  - `GET /analytics/ranking`
- 目標設定
  - `POST /goals`
  - `POST /goals/:id/tasks/breakdown`
  - `DELETE /goals/:id`
- 個人リザルト
  - `GET /tasks?type=weekly`
- シェア
  - `GET /posts`
  - `POST /posts`
  - `GET /analytics/ranking`
