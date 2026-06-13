# くら寿司メニュー自動更新

このプロジェクトは `scripts/fetch-kura-menu.js` でくら寿司公式ページからメニューを取得し、`menu-data.js` を更新します。

## ローカルで手動更新

```bash
npm install
npm run update-menu
```

## GitHub Actionsで自動更新

`.github/workflows/update-kura-menu.yml` により、毎日 04:00 JST に自動で更新されます。

更新がある場合は GitHub Actions が `menu-data.js` をコミットします。VercelとGitHubを連携していれば、そのコミットをきっかけにVercelも自動再デプロイされます。

## 注意

公式HTMLの構造が変わると取得に失敗する可能性があります。失敗時は GitHub Actions のログを確認してください。
