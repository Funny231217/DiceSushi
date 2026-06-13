# くら寿司メニュー自動更新

このプロジェクトは、くら寿司公式メニューHTMLから商品情報を取得して `menu-data.js` を更新します。

## 仕組み

- アプリ本体は `menu-data.js` を読み込みます。
- `scripts/fetch-kura-menu.js` が公式ページから商品名・価格・カロリー・カテゴリを抽出します。
- GitHub Actions が毎日自動実行し、変更があれば `menu-data.js` をコミットします。
- Vercel と GitHub を連携していれば、コミット後に自動デプロイされます。

## ローカルで手動更新

```bash
npm install
npm run update-menu
```

成功すると以下のように表示されます。

```text
くら寿司メニュー取得開始...
取得完了！
商品数: 207
```

## GitHub Actionsの手動実行

GitHub のリポジトリで以下を開きます。

```text
Actions
→ Update Kura Sushi menu
→ Run workflow
```

## 注意

くら寿司公式ページのHTML構造が変わると、抽出に失敗する可能性があります。
失敗した場合は `scripts/fetch-kura-menu.js` のセレクタを修正してください。
