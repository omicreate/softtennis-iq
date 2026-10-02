# ソフトテニスIQ

ソフトテニスIQ（Instagram・Threads・YouTube @softtennis_iq）のアプリです。ルールドリル・陣形ラボ・試合ノートの3つの道具を、1つのアプリにまとめていきます。

- 公開予定URL: https://omicreate.github.io/softtennis-iq/
- 画面: `#/`（ホーム）・`#/drill`（ルールドリル。`/review` 振り返り・`/record` 記録）・`#/jinkei`（陣形ラボ。`/setup` 陣形・`/save` 保存・共有）
- `#/note`（試合ノート。`/analysis` 分析・`/history` 履歴・`/menu` 試合・`/new` 新しい試合・`/edit`・`/archive` 保存済み試合・`/summary` サマリー画像）
- 陣形ラボの共有リンクは `?layout=…#/jinkei`。`?layout=` だけで開かれたときも陣形ラボを開く

## 移行の状況

| 道具 | 状況 | 旧アプリ |
|---|---|---|
| ルールドリル | このアプリで動く（新デザイン） | https://omicreate.github.io/soft-tennis-rule-drill/ （転送） |
| 陣形ラボ | このアプリで動く（新デザイン、2026-10-03） | https://omicreate.github.io/jinkei-lab/ （転送） |
| 試合ノート | このアプリで動く（新デザイン、2026-10-03） | https://omicreate.github.io/soft-tennis-note/ （転送） |

旧アプリと同じドメイン（omicreate.github.io）なので、端末内の記録は同じ保存キーでそのまま引き継ぎます。ルールドリルは `soft-tennis-rule-drill-progress-v1`、陣形ラボは `sti-court-slots`（配置メモリ）・`sti-court-junior`、試合ノートは `soft-tennis-logger-state-v1`（今の試合）・`soft-tennis-logger-archive-v1`（保存済み試合）。

## デザイン

- 色と書体は動画テンプレートと同じ（`src/design/tokens.css`）。強調色はボールの黄緑だけ。自チーム＝黄、相手＝白、失点・守備の穴＝赤。
- ボールの絵は縫い目のない軟式球。硬式テニスボールの表現（縫い目・フェルト・🎾）は使わない。
- 試合ノートは屋外で使うので、明るい「日なたモード」（`.theme-sun`）。スコアだけナイター色。

## 構成

- Vite + React + TypeScript。ビルド後は静的配信のみ（サーバーなし）
- `src/design/` 共通トークンと部品のスタイル
- `src/shell/` ホーム・画面の切り替え（ハッシュ）・流入計測
- `src/tools/jinkei/` 陣形ラボ（`geometry.ts` 座標・距離・到達目安、`presets.ts` 監修済み基準配置、`slots.ts` 配置メモリ、`layoutShare.ts` 共有リンク、`CourtCanvas.tsx` コート描画、`Jinkei.tsx` 画面）
- `src/tools/note/` 試合ノート。`engine/` は旧アプリの計算・保存・CSV・バックアップ・サマリー画像をほぼそのまま移したJS（`engine.d.ts` で型付け）。旧アプリの匿名化した実試合データで、分析値が一致することをテストしている（`note.test.ts`）
- `src/tools/drill/` ルールドリル（`questions.ts` 問題、`sources.ts` 出典、`logic.ts` 出題と記録、`Drill.tsx` 画面）
- `public/sw.js` オフライン対応。キャッシュ一覧はビルド時に `scripts/build-sw.mjs` が埋め込む。キャッシュの掃除は自分の接頭辞（`softtennis-iq-`）だけ
- アイコンは `public/icon.svg` を直して `npm run icons`

## 流入計測

`?src=` 付きで開いたときだけ、面の識別子とアプリ名を集計用の Google Apps Script へ1回送ります。アプリ名は旧アプリと同じ名前（ドリルなら `soft-tennis-rule-drill`）で送り、数値シートの集計を続けます。学習記録や入力内容は送りません。

## 確認方法

```sh
npm install
npm test
npm run build
npm run dev
```

問題を直すときは [docs/update-rules.md](docs/update-rules.md) の手順に従います。

## 権利

コード・画面デザイン・文言・問題は omicreate に帰属します（All rights reserved）。
