const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const MENU_URL = "https://www.kurasushi.co.jp/menu/?area=area0";
const OUTPUT_PATH = path.join(__dirname, "..", "menu-data.js");

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCategory($, item) {
  const section = item.closest("section");

  const candidates = [
    section.find(".menu-section-header").first().text(),
    section.find("h2").first().text(),
    section.find("h3").first().text(),
    item.closest(".menu-section").find(".menu-section-header").first().text(),
  ];

  for (const candidate of candidates) {
    const text = normalizeText(candidate)
      .replace(/開く|閉じる/g, "")
      .trim();

    if (text) return text;
  }

  return "その他";
}

function extractItems(html) {
  const $ = cheerio.load(html);
  const items = [];

  $(".menu-item").each((_, el) => {
    const item = $(el);
    const text = normalizeText(item.text());

    const name = normalizeText(
      item.find(".menu-name").first().text() ||
      item.find("h4.menu-name").first().text() ||
      item.find("h4").first().text() ||
      item.find("img").first().attr("alt")
    );

    const priceMatch = text.match(/([0-9,]+)\s*円/);
    const kcalMatch = text.match(/([0-9.]+)\s*kcal/i);

    const price = priceMatch
      ? Number(priceMatch[1].replace(/,/g, ""))
      : null;

    const calories = kcalMatch
      ? Number(kcalMatch[1])
      : null;

    const category = getCategory($, item);

    if (!name) return;

    items.push({
      id: items.length + 1,
      name,
      price,
      calories,
      category,
    });
  });

  const uniqueItems = [];
  const seen = new Set();

  for (const item of items) {
    const key = `${item.name}__${item.price}__${item.calories}__${item.category}`;

    if (seen.has(key)) continue;

    seen.add(key);
    uniqueItems.push({
      ...item,
      id: uniqueItems.length + 1,
    });
  }

  return uniqueItems;
}

async function main() {
  console.log("くら寿司メニュー取得開始...");
  console.log(`取得元: ${MENU_URL}`);

  const { data: html } = await axios.get(MENU_URL, {
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  const items = extractItems(html);

  if (items.length < 10) {
    const debugPath = path.join(__dirname, "..", "debug-kura.html");
    fs.writeFileSync(debugPath, html, "utf8");
    throw new Error(
      `抽出件数が少なすぎます: ${items.length}。debug-kura.html を確認してください。`
    );
  }

  const output =
    "// このファイルは scripts/fetch-kura-menu.js により自動生成されます。\n" +
    `// Last updated: ${new Date().toISOString()}\n` +
    "const KURA_MENU = " +
    JSON.stringify(items, null, 2) +
    ";\n";

  fs.writeFileSync(OUTPUT_PATH, output, "utf8");

  console.log("取得完了！");
  console.log(`商品数: ${items.length}`);
  console.log(`出力先: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("メニュー取得に失敗しました:");
  console.error(error);
  process.exit(1);
});
