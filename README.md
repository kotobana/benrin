# benrin

日課・週課・月課、メモ、読書記録を管理する個人用Webアプリ。日本時間・月曜始まり。

## ローカルで使う

Node.js 22.12以降を使用します。

```sh
npm ci
npm run dev
```

http://127.0.0.1:5173 を開きます。ローカルでは `.local/state.json` に保存されます（Git対象外）。開発サーバーは自分のPC内専用です。外部公開しないでください。

```sh
npm test
npm run build
```

## Cloudflareへの初回公開

CloudflareアカウントへのログインとAccess設定は所有者が行います。有料プランや外部APIは不要です。アカウント共通の無料利用枠には上限があります。

1. `npx wrangler login` を実行。
2. `npx wrangler d1 create benrin` を実行し、返されたIDで `wrangler.jsonc` の `database_id` を置き換える。
3. `npx wrangler d1 migrations apply benrin --remote` を実行。
4. `npm run deploy` を実行。この時点では設定不足のため全リクエストを503で拒否する。
5. Workersの設定から workers.dev のCloudflare Access保護を有効にし、AccessアプリのAllowポリシーで自分のメールアドレスだけを指定する。メールOTPなどのログイン方法を設定する。Bypassポリシーは作らない。
6. 以下を `npx wrangler secret put 名前` で設定する。
   - `ACCESS_DOMAIN`: `https://チーム名.cloudflareaccess.com`（末尾スラッシュなし）
   - `ACCESS_AUD`: AccessアプリのApplication Audience (AUD) Tag
   - `OWNER_EMAIL`: 許可した自分のメールアドレス
7. 未ログインで画面・`/api/state`にアクセスできないこと、自分のアカウントで読み書きできることを確認。
8. ローカルで作った記録は設定画面から書き出し、本番の設定画面で復元する。

全アセットとAPIでAccess JWTの署名・issuer・audience・所有者メールを検証。プレビューURLは無効。独自ドメインを追加する場合もAccess保護を設定する。

## データと運用

- D1の単一JSONレコードに小規模な個人データを保存。リビジョン一致時だけ更新し、他端末の変更を上書きしない。競合時は未保存データを書き出し、再読み込みして差分を反映する。
- 1回の保存は2MBまで。ファイル・画像のアップロードは初期版に含まない。件数が増えたら用途別テーブルと差分更新に移行する。
- メモは入力後に自動保存。日課・本は保存ボタンで確定。ネットワーク障害時は未保存表示と再試行を提供する。
- 日課は指定曜日、週課は週に1回、月課は月内1回または指定日以降に実行。存在しない日付は月末。過去の完了とスキップは保持。削除済みの日課も実行時の名前で履歴に残る。
- 設定画面から週に1回程度JSONを端末へバックアップ。復元は全件置換。バックアップには個人メモが含まれるため非公開の場所に保管する。
- より確実なバックアップ: `npx wrangler d1 export benrin --remote --output=backup.sql`。D1側の復旧機能も利用可能。
- 更新: `npm test` → `npm run build` → `npm run deploy`。失敗時はCloudflareのVersionsから以前のWorkerへ戻す。データは別途バックアップから復旧する。
- GitHubの自動デプロイは未設定。手動公開の認証確認後、Workers Buildsをリポジトリのmainに接続し、同じテスト・ビルドを設定する。

## 初期版の範囲

3アプリ、ホーム、検索、タグ、読書状態、評価、感想、本とメモの関連付け、ダークモード、JSON書き出し・復元。ツールの追加はコードで行う。現時点でPWA、通知、書籍API、自動バックアップ、複数ユーザーには対応していない。

## スペース階層と読書データの取り込み

- `/`: 活動を選ぶトップ（個人／無料塾）。
- `/personal`: 個人の日課・メモ・本棚。
- `/school`: 無料塾のホーム。授業前／授業中／授業後に分類した教材・ツールURLを登録・編集・検索。
- 今は同じ所有者のみ利用可能。スペースは画面と用途の区分であり、別ユーザーへの権限分離ではありません。講師・生徒共有は未実装です。
- 本棚に漫画／小説の分類、巻数、概要、媒体、取り込み元情報を追加。
- Google Sheets「本管理」から漫画155行、小説11行を取得。同一内容のBLEACH 2行のみまとめ、165件（漫画154・小説11）としてローカルに保存。
- 読書状態が空欄なら未設定。作品の「完結」は読了とみなさず元の状態として保持。更新日を読了日に転用しません。書名・著者・感想は原文のまま。
- 元シート、取り込み前後のバックアップはGit対象外の `.local/` に保存。機密データをソースコードや公開用アセットへ埋め込んでいません。
- Cloudflare公開後はローカル設定画面のJSON書き出し→本番設定画面の復元で移行できます。Google Sheetsとの自動同期はありません。
- ビルド済み画面の確認: `npm run build` → `npm run preview` → http://127.0.0.1:4173 。ローカル保存APIも利用できます。

## 公開環境（2026-09-30）

Worker benrin: https://benrin.benrin-47e25389.workers.dev
D1 benrin: 初期マイグレーション済み。個人データの移行は未実施。
Access未設定のため画面・API・アセットは503で拒否。Cloudflare Zero TrustでAccessを有効化し、所有者メールのみ許可するポリシーとACCESS_DOMAIN / ACCESS_AUD / OWNER_EMAILを設定する必要があります。
この実行環境ではWranglerの梱包処理が失敗するため、vite.worker.config.tsでWorkerをビルドし公式Direct Upload APIで配置しました。
