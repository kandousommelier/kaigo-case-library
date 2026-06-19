# PDF由来事例登録準備

このブランチでは、厚生労働省PDF由来の事例を追加登録しやすくするため、以下を実施しました。

- `cases.json` に `sourceType`、`sourceTitle`、`sourcePdf`、`sourceNote` を追加
- `app.js` の `FALLBACK_CASES` に同じ項目を追加
- キーワード検索対象に出典資料名と出典メモを追加
- 事例カードと詳細画面に出典資料名を表示
- READMEにPDFから事例を追加する手順を追加

PDF本文からの抽出は、このブランチでは行っていません。抽出済みJSONを次のPRで反映します。
