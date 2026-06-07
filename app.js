// =====================================================
// くら寿司 100番ランダム表 Supabase共有版
// 番号を選ぶ → メニューを押す → 自動で次番号へ
// =====================================================

const SUPABASE_URL = "https://ofnhujrptdrdpmywjvtj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbmh1anJwdGRyZHBteXdqdnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTMzMzIsImV4cCI6MjA5NjM2OTMzMn0.ROqqREZJWm3QPDhL8C7-ttdyALsuBpvBjTWW83LQre4";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const menuData = typeof KURA_MENU !== "undefined" ? KURA_MENU : [];

let table = {};
let selectedMenu = null;
let selectedTargetNumber = null;
let currentTableId = new URLSearchParams(location.search).get("table");

const $ = (id) => document.getElementById(id);

function money(n) {
    return n == null ? "価格不明" : `${n}円`;
}

function kcal(n) {
    return n == null ? "kcal不明" : `${n}kcal`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function canUseMessage(number) {
    return number <= 5 || number >= 96;
}

function showTab(tabId) {
    document
        .querySelectorAll("nav button,.tab")
        .forEach((x) => x.classList.remove("active"));

    const button = document.querySelector(`button[data-tab="${tabId}"]`);
    if (button) button.classList.add("active");

    const tab = $(tabId);
    if (tab) tab.classList.add("active");

    if (tabId === "table") {
        renderTable();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------
// タブ
// ---------------------

function tabs() {
    document.querySelectorAll("nav button").forEach((b) => {
        b.onclick = () => showTab(b.dataset.tab);
    });
}

// ---------------------
// カテゴリ・メニュー
// ---------------------

function setupCategories() {
    const cats = [
        "すべて",
        ...new Set(menuData.map((m) => m.category)),
    ];

    $("categorySelect").innerHTML = cats
        .map((c) => `<option>${escapeHtml(c)}</option>`)
        .join("");
}

function filtered() {
    const q = $("searchInput").value.trim();
    const cat = $("categorySelect").value;

    return menuData.filter((m) => {
        const okCat = cat === "すべて" || m.category === cat;
        const okSearch = !q || m.name.includes(q);
        return okCat && okSearch;
    });
}

function renderTargetStatus() {
    const targetStatus = $("targetStatus");
    if (!targetStatus) return;

    if (!selectedTargetNumber) {
        targetStatus.innerHTML = `
            <strong>登録先：未選択</strong><br>
            登録表で番号を選んでください。
        `;
        return;
    }

    const registered = table[selectedTargetNumber];
    const menu = getRegisteredMenu(registered);
    const currentText = registered?.itemType === "message"
        ? `現在：${escapeHtml(registered.message)}`
        : menu
            ? `現在：${escapeHtml(menu.name)}`
            : "現在：未登録";

    targetStatus.innerHTML = `
        <strong>登録先：${selectedTargetNumber}番</strong><br>
        ${currentText}
        <div class="smallBtns target-actions">
            <button id="cancelTargetBtn" class="sub">選択解除</button>
            <button id="nextTargetBtn">次の番号へ</button>
        </div>
    `;

    $("cancelTargetBtn").onclick = () => {
        selectedTargetNumber = null;
        renderTargetStatus();
        renderMenu();
    };

    $("nextTargetBtn").onclick = () => {
        moveToNextTargetNumber();
        renderTargetStatus();
        renderMenu();
    };
}

function renderMenu() {
    renderTargetStatus();

    const list = filtered();
    const buttonText = selectedTargetNumber
        ? `${selectedTargetNumber}番に登録`
        : "先に登録表で番号を選ぶ";

    $("menuList").innerHTML =
        list
            .map(
                (m) => `
                    <article class="card">
                        <h3>${escapeHtml(m.name)}</h3>
                        <div class="meta">
                            ${money(m.price)} / ${kcal(m.calories)} / ${escapeHtml(m.category)}
                        </div>
                        <button data-id="${m.id}">${buttonText}</button>
                    </article>
                `
            )
            .join("") || '<p class="empty">該当メニューがありません</p>';

    document.querySelectorAll("[data-id]").forEach((btn) => {
        btn.onclick = async () => {
            if (!selectedTargetNumber) {
                alert("先に登録表で番号を選んでください");
                showTab("table");
                return;
            }

            const id = Number(btn.dataset.id);
            const menu = menuData.find((m) => Number(m.id) === id);
            await saveNumber(selectedTargetNumber, menu);

            const registeredNumber = selectedTargetNumber;
            moveToNextTargetNumber();
            renderTargetStatus();
            renderMenu();

            const nextText = selectedTargetNumber
                ? `次は${selectedTargetNumber}番です`
                : "100番まで登録済みです";

            showToast(`${registeredNumber}番に登録しました。${nextText}`);
        };
    });
}

// ---------------------
// モーダル：旧登録方式の予備
// ---------------------

function openModal(menu) {
    selectedMenu = menu;

    $("modalName").textContent = menu.name;
    $("modalInfo").textContent =
        `${money(menu.price)} / ${kcal(menu.calories)} / ${menu.category}`;

    $("numberInput").value = selectedTargetNumber || "";
    $("modal").classList.add("show");
}

function closeModal() {
    $("modal").classList.remove("show");
}

// ---------------------
// Supabase
// ---------------------

async function createSharedTable() {
    const { data, error } = await db
        .from("sushi_tables")
        .insert({})
        .select()
        .single();

    if (error) {
        console.error(error);
        alert("共有表の作成に失敗しました");
        return;
    }

    currentTableId = data.id;

    const newUrl =
        location.origin +
        location.pathname +
        "?table=" +
        currentTableId;

    history.replaceState(null, "", newUrl);

    console.log("共有表を作成しました:", currentTableId);
}

async function loadSharedTable() {
    if (!currentTableId) return;

    const { data, error } = await db
        .from("sushi_table_items")
        .select("*")
        .eq("table_id", currentTableId);

    if (error) {
        console.error(error);
        alert("共有表の読み込みに失敗しました");
        return;
    }

    table = {};

    data.forEach((row) => {
        if (row.item_type === "message") {
            table[row.number] = {
                itemType: "message",
                message: row.message || "",
                savedAt: row.updated_at,
            };
        } else {
            table[row.number] = {
                itemType: "menu",
                menuId: row.menu_id,
                savedAt: row.updated_at,
            };
        }
    });
}

async function saveNumber(number, menu) {
    if (!currentTableId) {
        await createSharedTable();
    }

    const { error } = await db
        .from("sushi_table_items")
        .upsert(
            {
                table_id: currentTableId,
                number: number,
                menu_id: String(menu.id),
                message: null,
                item_type: "menu",
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "table_id,number",
            }
        );

    if (error) {
        console.error(error);
        alert("保存に失敗しました");
        return;
    }

    table[number] = {
        itemType: "menu",
        menuId: String(menu.id),
        savedAt: new Date().toISOString(),
    };

    renderTable();
}

async function saveMessageNumber(number, message) {
    if (!currentTableId) {
        await createSharedTable();
    }

    const { error } = await db
        .from("sushi_table_items")
        .upsert(
            {
                table_id: currentTableId,
                number: number,
                menu_id: null,
                message: message,
                item_type: "message",
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "table_id,number",
            }
        );

    if (error) {
        console.error(error);
        alert("メッセージ保存に失敗しました");
        return;
    }

    table[number] = {
        itemType: "message",
        message: message,
        savedAt: new Date().toISOString(),
    };

    renderTable();
}

async function deleteNumber(number) {
    if (!confirm(`${number}番の登録を削除しますか？`)) return;

    const { error } = await db
        .from("sushi_table_items")
        .delete()
        .eq("table_id", currentTableId)
        .eq("number", number);

    if (error) {
        console.error(error);
        alert("削除に失敗しました");
        return;
    }

    delete table[number];
    renderTable();
    renderTargetStatus();
    renderMenu();
}

async function resetAll() {
    if (!confirm("登録表をすべて削除しますか？")) return;
    if (!confirm("全員共通の表が消えます。本当に削除しますか？")) return;

    const { error } = await db
        .from("sushi_table_items")
        .delete()
        .eq("table_id", currentTableId);

    if (error) {
        console.error(error);
        alert("リセットに失敗しました");
        return;
    }

    table = {};
    selectedTargetNumber = null;

    const historyKey = `kura_history_${currentTableId}`;
    localStorage.removeItem(historyKey);

    renderTable();
    renderMenu();
    loadHistory();

    $("result").textContent = "まだ抽選していません";
    updateTotalPrice();
}

// ---------------------
// 登録表
// ---------------------

function findMenuById(id) {
    return menuData.find((m) => String(m.id) === String(id));
}

function getRegisteredMenu(item) {
    if (!item || item.itemType === "message") return null;
    return findMenuById(item.menuId);
}

function selectTargetNumber(number) {
    selectedTargetNumber = number;
    showTab("menu");
    renderTargetStatus();
    renderMenu();
}

function findNextNumber(startNumber) {
    for (let i = startNumber; i <= 100; i++) {
        return i;
    }

    return null;
}

function findFirstEmptyNumber() {
    for (let i = 1; i <= 100; i++) {
        if (!table[i]) return i;
    }

    return 1;
}

function moveToNextTargetNumber() {
    if (!selectedTargetNumber) return;

    const next = selectedTargetNumber + 1;
    selectedTargetNumber = next <= 100 ? next : null;
}

function renderTable() {
    let html = "";

    for (let i = 1; i <= 100; i++) {
        const registered = table[i];
        const menu = getRegisteredMenu(registered);
        const selectedClass = selectedTargetNumber === i ? " selected-row" : "";

        let body = "";

        if (registered?.itemType === "message") {
            body = `
                <h3>${escapeHtml(registered.message)}</h3>
                <div class="meta">任意メッセージ</div>
                <div class="smallBtns">
                    <button data-target="${i}">この番号に登録</button>
                    <button data-message="${i}">メッセージ変更</button>
                    <button class="sub" data-del="${i}">削除</button>
                </div>
            `;
        } else if (menu) {
            body = `
                <h3>${escapeHtml(menu.name)}</h3>
                <div class="meta">
                    ${money(menu.price)} / ${kcal(menu.calories)} / ${escapeHtml(menu.category)}
                </div>
                <div class="smallBtns">
                    <button data-target="${i}">この番号に変更</button>
                    <button class="sub" data-del="${i}">削除</button>
                </div>
            `;
        } else if (canUseMessage(i)) {
            body = `
                <span class="empty">未登録</span>
                <div class="smallBtns">
                    <button data-target="${i}">この番号に登録</button>
                    <button data-message="${i}">メッセージ登録</button>
                </div>
            `;
        } else {
            body = `
                <span class="empty">未登録</span>
                <div class="smallBtns">
                    <button data-target="${i}">この番号に登録</button>
                </div>
            `;
        }

        html += `
            <article class="row${selectedClass}">
                <div class="num">${i}</div>
                <div>${body}</div>
            </article>
        `;
    }

    $("tableList").innerHTML = html;

    document.querySelectorAll("[data-target]").forEach((b) => {
        b.onclick = () => selectTargetNumber(Number(b.dataset.target));
    });

    document.querySelectorAll("[data-del]").forEach((b) => {
        b.onclick = () => deleteNumber(Number(b.dataset.del));
    });

    document.querySelectorAll("[data-message]").forEach((b) => {
        b.onclick = async () => {
            const number = Number(b.dataset.message);

            if (!canUseMessage(number)) {
                alert("メッセージ登録できるのは1〜5、96〜100だけです");
                return;
            }

            const currentMessage =
                table[number]?.itemType === "message"
                    ? table[number].message
                    : "";

            const message = prompt(
                `${number}番に入れるメッセージを入力`,
                currentMessage
            );

            if (message == null) return;

            if (!message.trim()) {
                alert("空のメッセージは登録できません");
                return;
            }

            await saveMessageNumber(number, message.trim());
            selectedTargetNumber = number < 100 ? number + 1 : null;
            renderTargetStatus();
            renderMenu();
        };
    });

    updateTotalPrice();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playNumberOneEffect() {
    const effect = $("specialEffect");
    const text = $("effectText");
    const image = $("effectImage");

    effect.classList.add("show");

    text.className = "effect-text";
    image.className = "effect-image";

    text.textContent = "まずは、ありがとう";
    text.classList.add("show");

    await sleep(2600);

    text.className = "effect-text hit";
    text.textContent = "クリティカル";

    await sleep(3000);

    effect.classList.remove("show");
    text.className = "effect-text";
}

async function playNumberHundredEffect() {
    const effect = $("specialEffect");
    const text = $("effectText");
    const image = $("effectImage");

    effect.classList.add("show");

    text.className = "effect-text";
    image.className = "effect-image";

    await sleep(700);

    image.classList.add("show");

    await sleep(3500);

    effect.classList.remove("show");
    image.className = "effect-image";
}

// ---------------------
// 抽選
// ---------------------

async function draw() {
    const n = Math.floor(Math.random() * 100) + 1;

    if (n === 1) {
        await playNumberOneEffect();
    }

    if (n === 100) {
        await playNumberHundredEffect();
    }

    const registered = table[n];
    const menu = getRegisteredMenu(registered);

    if (registered?.itemType === "message") {
        $("result").innerHTML = `
            <strong>${n}番</strong><br>
            ${escapeHtml(registered.message)}
        `;

        saveHistory({
            number: n,
            menu_id: null,
            message: registered.message,
            price: 0,
        });
    } else if (menu) {
        $("result").innerHTML = `
            <strong>${n}番</strong><br>
            ${escapeHtml(menu.name)}<br>
            <span class="meta">
                ${money(menu.price)} / ${kcal(menu.calories)} / ${escapeHtml(menu.category)}
            </span>
        `;

        saveHistory({
            number: n,
            menu_id: String(menu.id),
            message: menu.name,
            price: Number(menu.price || 0),
        });
    } else {
        $("result").innerHTML = `<strong>${n}番</strong><br>未登録`;

        saveHistory({
            number: n,
            menu_id: null,
            message: "未登録",
            price: 0,
        });
    }

    loadHistory();
}

// ---------------------
// 履歴：ローカル保存
// ---------------------

function saveHistory(history) {
    const key = `kura_history_${currentTableId}`;

    const histories = JSON.parse(
        localStorage.getItem(key) || "[]"
    );

    histories.unshift({
        id: Date.now(),
        number: history.number,
        message: history.message,
        price: history.price,
        created_at: new Date().toISOString(),
    });

    const limited = histories.slice(0, 50);

    localStorage.setItem(
        key,
        JSON.stringify(limited)
    );
}

function loadHistory() {
    const historyList = $("historyList");
    if (!historyList) return;

    const key = `kura_history_${currentTableId}`;

    const data = JSON.parse(
        localStorage.getItem(key) || "[]"
    );

    historyList.innerHTML =
        data
            .map(
                (h) => `
                    <div class="history-item">
                        <strong>${h.number}番</strong>
                        ${escapeHtml(h.message || "未登録")}
                        <button data-history-del="${h.id}">削除</button>
                    </div>
                `
            )
            .join("") || "履歴なし";

    document.querySelectorAll("[data-history-del]").forEach((btn) => {
        btn.onclick = () => deleteHistory(btn.dataset.historyDel);
    });

    updateTotalPrice();
}

function deleteHistory(id) {
    const key = `kura_history_${currentTableId}`;

    let histories = JSON.parse(
        localStorage.getItem(key) || "[]"
    );

    histories = histories.filter(
        (h) => String(h.id) !== String(id)
    );

    localStorage.setItem(
        key,
        JSON.stringify(histories)
    );

    loadHistory();
}

function clearHistory() {
    if (!confirm("履歴をすべて削除しますか？")) {
        return;
    }

    const key = `kura_history_${currentTableId}`;
    localStorage.removeItem(key);

    loadHistory();
    updateTotalPrice();

    alert("履歴を削除しました");
}

// ---------------------
// 合計金額：ローカル履歴から計算
// ---------------------

function updateTotalPrice() {
    const totalPrice = $("totalPrice");
    if (!totalPrice) return;

    const key = `kura_history_${currentTableId}`;

    const histories = JSON.parse(
        localStorage.getItem(key) || "[]"
    );

    let total = 0;

    histories.forEach((h) => {
        total += Number(h.price || 0);
    });

    totalPrice.textContent = `引いた合計金額：${total}円`;
}

// ---------------------
// 通知
// ---------------------

function showToast(message) {
    const oldToast = document.querySelector(".toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 1800);
}

// ---------------------
// 初期化
// ---------------------

async function init() {
    tabs();
    setupCategories();

    $("drawBtn").onclick = draw;
    $("searchInput").oninput = renderMenu;
    $("categorySelect").onchange = renderMenu;
    $("closeModal").onclick = closeModal;

    $("saveNumberBtn").onclick = async () => {
        const n = Number($("numberInput").value);

        if (!selectedMenu || n < 1 || n > 100) {
            alert("1〜100の番号を入力してください");
            return;
        }

        await saveNumber(n, selectedMenu);
        selectedTargetNumber = n < 100 ? n + 1 : null;

        closeModal();
        renderTargetStatus();
        renderMenu();
        alert(`${n}番に登録しました`);
    };

    $("resetBtn").onclick = resetAll;

    const clearHistoryBtn = $("clearHistoryBtn");
    if (clearHistoryBtn) {
        clearHistoryBtn.onclick = clearHistory;
    }

    const copyShareUrlBtn = $("copyShareUrlBtn");
    if (copyShareUrlBtn) {
        copyShareUrlBtn.onclick = async () => {
            await navigator.clipboard.writeText(location.href);
            alert("共有URLをコピーしました");
        };
    }

    const startFirstEmptyBtn = $("startFirstEmptyBtn");
    if (startFirstEmptyBtn) {
        startFirstEmptyBtn.onclick = () => {
            selectedTargetNumber = findFirstEmptyNumber();
            showTab("menu");
            renderTargetStatus();
            renderMenu();
        };
    }

    if (!currentTableId) {
        await createSharedTable();
    }

    await loadSharedTable();

    renderMenu();
    renderTable();
    loadHistory();
}

init();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
}
