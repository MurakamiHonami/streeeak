# Streeeak
～ 「漠然とした夢」を、今日クリアすべき「クエスト」に変えよう。 ～

## 1. プロジェクトについて
「大きな夢はあるけれど、今何をすべきかわからない」<br>
「一人で頑張ろうと決意しても、つい後回しにして三日坊主で終わってしまう」<br>
そんなもどかしさや焦りを感じたことはありませんか？<br>

Streeeak（ストリーク）は、長期目標を月次・週次・日次に分解し、日々の達成を継続・可視化するWebアプリです。<br>
AIが専属メンターとしてあなたの目標を完全ナビゲートし、「今日やること」まで具体的に逆算してくれます。<br>
さらに、仲間と進捗を共有し競い合うことで「サボれない環境」を作り出し、モチベーションの低下を防ぎます。<br>
一人では続かない目標達成を、ゲーム感覚のクエストへと変えるサービスです。<br>

## 2. コア機能
 - 目標ブレイクダウン
Gemini API（gemini-2.0-flash）を活用。<br>
「長期目標」と「期限」を入力するだけで、メンターAIが対話形式であなたにぴったりの短期目標や毎日のTODOを自動生成・調整してくれます。

 - デイリーTODO＆持ち越し機能
「今日やるべきこと」がひと目でわかるUI。<br>
もしタスクが未達成で終わってしまっても、翌日へ自動的に引き継がれるため、挫折せずに再スタートを切ることができます。

 - チームランキング＆シェア
1週間の達成率をもとにグループ内でトップ3をランキング表示。<br>
「あいつ、今日も進めてる…！」というポジティブな焦りを生み出します。週末にはリセットされ、新たなバトルがスタートします。

 - 自動投稿＆AIエール
指定した時間に自動で進捗をタイムラインにシェア。<br>
さらに、タスクを完了すると特別な演出を表示するなど、モチベーションを維持する仕組みが詰まっています。
## 3. 使用技術
### Frontend
| カテゴリ | 技術・ライブラリ | 用途・備考 |
| :--- | :--- | :--- |
| **Core** | React 19, TypeScript 5.9 | UI構築、静的型付けによる堅牢な開発 |
| **Build & Routing** | Vite 7, Node.js 20, React Router 7 | 高速な開発環境・ビルド、クライアントサイドルーティング |
| **State & Fetch** | TanStack Query 5, Axios | サーバー状態のキャッシュ・非同期通信の最適化 |
| **UI & Styling** | MUI 7, Tailwind CSS 4, Emotion | コンポーネント基盤、ユーティリティファーストなスタイリング |
| **Others** | Stripe React, i18next, Day.js | 決済UI、多言語対応、直感的な日付操作 |

### Backend
| カテゴリ | 技術・ライブラリ | 用途・備考 |
| :--- | :--- | :--- |
| **Core** | Python 3.11, FastAPI, Uvicorn | 高速なAPIルーティングと非同期処理（ASGI） |
| **ORM & Validation** | SQLAlchemy 2, Pydantic 2 | DBアクセス、リクエスト/レスポンスの厳格な型バリデーション |
| **Auth & Security** | python-jose, passlib (bcrypt) | JWTによるトークンベース認証、パスワードのハッシュ化 |
| **External Integrations**| httpx, boto3, Stripe | Gemini API等の外部連携、AWS S3へのアバター画像アップロード、サブスク決済処理 |

### Database
| カテゴリ | 技術・ライブラリ | 用途・備考 |
| :--- | :--- | :--- |
| **Database** | PostgreSQL, psycopg 3 | 本番RDB環境、コネクションプールによる死活監視 |
| **AI** | Google Gemini API (1.5-flash等) | 自然言語処理による目標のブレイクダウンとリビジョン提案 |

### Infrastructure (IaC)
| カテゴリ | 技術・ライブラリ | 用途・備考 |
| :--- | :--- | :--- |
| **Provisioning,Terraform** | 1.11 | インフラのコード化（IaC）による環境の再現性確保 |
| **Remote State** | S3 & DynamoDB | ステートファイルの共有と排他制御（ロック機能）|
| **Compute** | AWS EC2 (Amazon Linux 2) | アプリケーションサーバーのホスティング |
| **Storage & CDN** | S3 & CloudFront | 静的コンテンツ（React）の配信、アバター画像の保存 |
| **Database** | RDS for PostgreSQL | Multi-AZ構成による高い可用性と自動フェイルオーバー |
| **Networking** | ALB, Route53, ACM | 負荷分散、独自ドメイン運用、全通信の常時 HTTPS 化 |
| **CI/CD** | AWS CodePipeline | CodeBuild / CodeDeploy を連携させたフルオートデプロイ |

### 4. システム構成図
<img width="2816" height="1536" alt="構成図" src="https://github.com/user-attachments/assets/34d83f6b-0e7e-458d-a7c8-126f19155f2f" />


### 5. 起動方法
1) Backendの起動
```
Bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
.env に環境変数を設定後、サーバーを起動します。

DATABASE_URL=postgresql+psycopg://<user>@localhost:5432/streeeak
GEMINI_API_KEY=<your_api_key>
STRIPE_SECRET_KEY=<your_stripe_key>

2) Frontendの起動
必要に応じて frontend/.env を作成し、以下を設定してください：

VITE_API_BASE_URL=http://localhost:8000
VITE_DEFAULT_USER_ID=1
開発サーバーを起動します：
```
Bash
cd frontend
npm install
npm run dev
```

3) インフラの構築 (Terraform)<br>
terraform.tfvarsを作成し、必要な機密情報（APIキー等）を入力
```
Bash
cd terraform_project/enviroments/prod
terraform init
terraform apply
```

### http://localhost:5173 にアクセスしてください
