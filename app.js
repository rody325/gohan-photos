'use strict';
/* ごはん写真 — 写真はこの端末の IndexedDB にだけ保存する */
(() => {
  const VERSION = '1.9.1';
  const APP_ID = 'gohan-photos';
  const TRASH_DAYS = 30;
  const DAY = 864e5;
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  // 押すだけで入れたり外したりできるアルバム（いくつでも同時に選べる。記録には albums に 'q:〜' として保存）
  // ※「食事（朝・昼・夜）」と「どこで」の欄はなくした（2026-09-22）。前に記録した値は消さずに残している
  const QUICK = [
    { k: 'mama', label: 'ママごはん', icon: 'mama' },
    { k: 'papa', label: 'パパごはん', icon: 'papa' },
    { k: 'bento', label: 'お弁当', icon: 'bento' },
    { k: 'out', label: '外食', icon: 'out' },
    { k: 'sweets', label: 'スイーツ', icon: 'sweets' },
  ];
  const qid = k => 'q:' + k;
  // 1.5.0 まではお弁当・外食を style に1つだけ入れていたので、それも「入っている」とみなす
  const inQuick = (m, k) => m.albums.includes(qid(k)) || m.style === k;
  function setQuick(m, k, on) {
    m.albums = m.albums.filter(x => x !== qid(k));
    if (m.style === k) m.style = null;
    if (on) m.albums.push(qid(k));
  }
  const quickLabels = m => QUICK.filter(q => inQuick(m, q.k)).map(q => q.label);
  const quickChipsHTML = m => `<div class="chips" data-f="quick">${QUICK.map(q => `<button class="chip ${inQuick(m, q.k) ? 'on' : ''}" data-v="${q.k}">${icon(q.icon)}${q.label}</button>`).join('')}</div>`;
  // 文字の大きさ（CSS の --fs に入れる倍率）
  const FONT_SCALES = { m: 1, l: 1.15, xl: 1.3 };

  /* ---------- アイコン ---------- */
  const ICON = {
    photos: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17.5 4.6-4.6 3.4 3.4 2.6-2.6 5 5"/>',
    albums: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M9 3.5v17"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
    more: '<circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    backup: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5"/>',
    restore: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    bowl: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8.5 20.5h7"/><path d="M9 8.5c0-1.5 1-1.5 1-3M12.5 8.5c0-1.5 1-1.5 1-3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    recipe: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6M9 11h6"/>',
    bento: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 11.5h17M11 11.5V19"/><path d="M8 3.5h8"/>',
    out: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
    mama: '<circle cx="12" cy="8" r="3.6"/><path d="M8.5 9.5c-.6 2.2-1.8 3.3-3.5 3.6M15.5 9.5c.6 2.2 1.8 3.3 3.5 3.6"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    papa: '<circle cx="12" cy="7.5" r="3.6"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="m12 14.5-1.3 2.2 1.3 3.8 1.3-3.8z"/>',
    sweets: '<path d="M5.5 12h13l-1.6 8.5H7.1z"/><path d="M5.5 12a6.5 6.5 0 0 1 13 0"/><path d="M12 5.5V3.5M9.5 16h5"/>',
  };

  /* ---------- 小道具 ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = n => String(n).padStart(2, '0');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
  const typing = el => !!el?.matches?.('input, textarea');

  const sod = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const monthKey = t => dayKey(t).slice(0, 7);
  const thisYear = t => new Date(t).getFullYear() === new Date().getFullYear();
  const md = (t, year = !thisYear(t)) => { const d = new Date(t); return `${year ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`; };
  const hm = t => { const d = new Date(t); return `${d.getHours()}:${pad(d.getMinutes())}`; };
  const toInput = t => { const d = new Date(t); return `${dayKey(t)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromInput = s => { const t = new Date(s).getTime(); return isNaN(t) ? null : t; };
  const fmtSize = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;
  function dayTitle(t) {
    const diff = Math.round((sod(Date.now()) - sod(t)) / DAY);
    if (diff === 0) return { main: '今日', sub: md(t) };
    if (diff === 1) return { main: '昨日', sub: md(t) };
    return { main: md(t), sub: '' };
  }

  /* ---------- 設定（端末ごとの小さな値だけ） ---------- */
  const SKEY = 'gohan-settings';
  const S = Object.assign(
    { quality: 'std', cols: 3, font: 'xl', fontChosen: false, ocrDir: 'h', lastBackup: 0, snooze: 0, hideInstall: false },
    (() => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch { return {}; } })()
  );
  // 文字の大きさは最初から「特大」。設定で自分で選ぶまでは特大にする（1.6.0 までに保存された「大きい」も特大に）
  if (!S.fontChosen) S.font = 'xl';
  const saveS = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch { /* 保存できなくても動作は続ける */ } };
  const applyCols = () => document.documentElement.style.setProperty('--cols', S.cols);
  const applyFont = () => document.documentElement.style.setProperty('--fs', FONT_SCALES[S.font] || FONT_SCALES.xl);

  /* ---------- データベース ---------- */
  const db = {
    _p: null,
    open() {
      return this._p || (this._p = new Promise((res, rej) => {
        // 版2で kv（バックアップの上書き先など、小さな値）を追加。meals などの中身はそのまま引き継がれる
        const r = indexedDB.open(APP_ID, 2);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const s of ['meals', 'photos', 'albums', 'kv']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        };
        r.onsuccess = () => {
          // 新しい版のアプリが開いたら、この古いつながりは閉じて切り替えを邪魔しない
          r.result.onversionchange = () => { r.result.close(); toast('新しい版になりました。アプリを開き直してください', 0); };
          res(r.result);
        };
        r.onerror = () => rej(r.error);
        r.onblocked = () => toast('ほかの画面で開いている「ごはん写真」を閉じてください', 0);
      }));
    },
    async run(stores, mode, fn) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const tx = d.transaction(stores, mode);
        let out;
        const req = fn(tx);
        if (req) req.onsuccess = () => { out = req.result; };
        tx.oncomplete = () => res(out);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error || new Error('abort'));
      });
    },
    getAll(s) { return this.run(s, 'readonly', tx => tx.objectStore(s).getAll()); },
    get(s, k) { return this.run(s, 'readonly', tx => tx.objectStore(s).get(k)); },
    put(s, v) { return this.run(s, 'readwrite', tx => { tx.objectStore(s).put(v); }); },
    del(s, k) { return this.run(s, 'readwrite', tx => { tx.objectStore(s).delete(k); }); },
  };

  /* ---------- 状態 ---------- */
  const state = { meals: [], albums: [], tab: 'photos', calMonth: null };
  const blankMeal = () => ({
    id: uid(), takenAt: Date.now(), meal: null, style: null, memo: '', recipe: '', place: '', tags: [],
    fav: false, albums: [], deletedAt: 0, createdAt: Date.now(), w: 0, h: 0, thumb: null,
  });
  const live = () => state.meals.filter(m => !m.deletedAt);
  const sortMeals = () => state.meals.sort((a, b) => b.takenAt - a.takenAt);
  const saveMeal = m => db.put('meals', m);
  const fullBlob = async id => (await db.get('photos', id))?.blob || null;

  // メモなど文字の入力はまとめて保存する
  const dirtyMeals = new Set();
  function flushNow() { dirtyMeals.forEach(m => saveMeal(m)); dirtyMeals.clear(); }
  const flushSoon = debounce(flushNow, 400);
  const queueSave = m => { dirtyMeals.add(m); flushSoon(); };

  const urls = new Map();
  function thumbURL(m) {
    let u = urls.get(m.id);
    if (!u && m.thumb) { u = URL.createObjectURL(m.thumb); urls.set(m.id, u); }
    return u || '';
  }
  function dropURL(id) { const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } }

  async function saveNew({ meal, full }) {
    await db.run(['meals', 'photos'], 'readwrite', tx => {
      tx.objectStore('meals').put(meal);
      tx.objectStore('photos').put({ id: meal.id, blob: full });
    });
    state.meals.push(meal);
    sortMeals();
  }
  async function trashMeals(ids) {
    const set = new Set(ids), now = Date.now();
    const ms = state.meals.filter(m => set.has(m.id) && !m.deletedAt);
    for (const m of ms) { m.deletedAt = now; await saveMeal(m); }
    refresh();
    toast(`${ms.length}枚をごみ箱に移動しました`, 4500, { label: '元に戻す', fn: () => restoreMeals(ms.map(m => m.id)) });
  }
  async function restoreMeals(ids) {
    const set = new Set(ids);
    for (const m of state.meals) if (set.has(m.id) && m.deletedAt) { m.deletedAt = 0; await saveMeal(m); }
    refresh();
  }
  async function hardDelete(ids) {
    await db.run(['meals', 'photos'], 'readwrite', tx => {
      for (const id of ids) { tx.objectStore('meals').delete(id); tx.objectStore('photos').delete(id); }
    });
    const set = new Set(ids);
    state.meals = state.meals.filter(m => !set.has(m.id));
    ids.forEach(dropURL);
  }
  async function createAlbum(name) {
    const a = { id: uid(), name, createdAt: Date.now() };
    await db.put('albums', a);
    state.albums.push(a);
    return a;
  }
  async function deleteAlbum(id) {
    for (const m of state.meals) if (m.albums.includes(id)) { m.albums = m.albums.filter(x => x !== id); await saveMeal(m); }
    await db.del('albums', id);
    state.albums = state.albums.filter(a => a.id !== id);
    refresh();
    toast('アルバムを削除しました');
  }
  async function requestPersist() {
    try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* 対応していない端末 */ }
  }

  /* ---------- 画面の重なり（戻るボタン・戻るジェスチャーに対応） ---------- */
  const stack = [];
  let afterPop = [];
  const topLayer = () => stack[stack.length - 1];
  function pushLayer(layer) { stack.push(layer); history.pushState({ n: stack.length }, ''); return layer; }
  function back(then) { if (then) afterPop.push(then); if (stack.length) history.back(); else runAfterPop(); }
  function runAfterPop() { const a = afterPop; afterPop = []; a.forEach(f => f()); }
  addEventListener('popstate', () => { const l = stack.pop(); if (l) l.close(); runAfterPop(); });

  function pushScreen(el, { refresh: onRefresh, onClose } = {}) {
    el.addEventListener('click', e => { if (e.target.closest('[data-a="back"]')) back(); });
    document.body.append(el);
    el.getBoundingClientRect();
    el.classList.add('in');
    return pushLayer({
      el, refresh: onRefresh,
      close() { onClose?.(); el.classList.remove('in'); setTimeout(() => el.remove(), 320); },
    });
  }
  function openSheet(inner, { cls = '', onClose } = {}) {
    const wrap = h(`<div class="sheet-wrap"><div class="sheet ${cls}"><div class="grab"></div></div></div>`);
    const sheet = wrap.firstElementChild;
    sheet.insertAdjacentHTML('beforeend', inner);
    wrap.addEventListener('click', e => { if (e.target === wrap) back(); });
    document.body.append(wrap);
    wrap.getBoundingClientRect();
    wrap.classList.add('in');
    return pushLayer({
      el: sheet,
      close() { onClose?.(); wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 320); },
    });
  }
  function ask({ title, msg = '', ok = 'OK', cancel = 'キャンセル', danger = false }) {
    return new Promise(resolve => {
      let result = false;
      const el = h(`<div class="dlg-wrap"><div class="dlg" role="dialog"><h3>${esc(title)}</h3>${msg ? `<p>${esc(msg)}</p>` : ''}<div class="dlg-btns">${cancel ? `<button data-r="0">${esc(cancel)}</button>` : ''}<button data-r="1" class="${danger ? 'danger' : 'primary'}">${esc(ok)}</button></div></div></div>`);
      el.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (b) { result = b.dataset.r === '1'; back(); } else if (e.target === el) back();
      });
      document.body.append(el);
      pushLayer({ el, close() { el.remove(); resolve(result); } });
    });
  }
  function askText({ title, value = '', placeholder = '', ok = 'OK' }) {
    return new Promise(resolve => {
      let result = null;
      const el = h(`<div class="dlg-wrap"><form class="dlg"><h3>${esc(title)}</h3><input class="inp" maxlength="40" placeholder="${esc(placeholder)}" value="${esc(value)}"><div class="dlg-btns"><button type="button" data-r="0">キャンセル</button><button type="submit" class="primary">${esc(ok)}</button></div></form></div>`);
      const inp = $('input', el);
      $('form', el).addEventListener('submit', e => {
        e.preventDefault();
        const v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        result = v; back();
      });
      el.addEventListener('click', e => { if (e.target.dataset.r === '0' || e.target === el) back(); });
      document.body.append(el);
      pushLayer({ el, close() { el.remove(); resolve(result); } });
      setTimeout(() => inp.focus(), 60);
    });
  }

  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg, ms = 2600, action) {
    clearTimeout(toastTimer);
    // 消すときは「元に戻す」の働きも外す（消えたあとに押されて、勝手に元に戻らないように）
    const hide = () => { toastEl.classList.remove('show'); const b = toastEl.querySelector('button'); if (b) b.onclick = null; };
    toastEl.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
    if (action) toastEl.querySelector('button').onclick = () => { hide(); action.fn(); };
    toastEl.classList.add('show');
    if (ms) toastTimer = setTimeout(hide, ms);
    return { update(m) { const s = toastEl.querySelector('span'); if (s) s.textContent = m; }, close: hide };
  }

  /* ---------- 音声入力（スマホの音声認識を使う） ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micHTML = f => `<button type="button" class="mic" data-mic="${f}">${icon('mic')}<span>話して入力</span></button>`;
  let rec = null, recBtn = null;
  function stopMic() { if (rec) { try { rec.abort(); } catch { /* 止まっている */ } } }
  // 1回話すごとに、入力欄の末尾へ書き足す（止まったらもう一度押す）
  function startMic(btn, target, interimEl) {
    if (rec) { const same = recBtn === btn; stopMic(); if (same) return; }
    if (!target) return;
    if (!SR || !window.isSecureContext) {
      toast('この画面では使えません。キーボードのマイクボタンで話して入力できます', 5000);
      return;
    }
    const r = new SR();
    r.lang = 'ja-JP';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 5;
    rec = r; recBtn = btn;
    btn.classList.add('on');
    btn.querySelector('span').textContent = '聞いています（押すと止まる）';
    // レシピ欄は料理のことばの辞書でしっかり直す。メモ欄は人名などを置き換えないよう軽めに直す
    const mode = target.dataset.f === 'recipe' ? 'recipe' : 'light';
    const VF = window.VoiceFix;
    r.onresult = e => {
      let interim = '';
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const res = e.results[k];
        if (!res.isFinal) { interim += res[0].transcript; continue; }
        const alts = Array.from({ length: res.length }, (_, j) => res[j].transcript);
        const best = VF ? VF.pick(alts, mode) : { text: alts[0].trim(), changes: [] };
        if (!best || !best.text) continue;
        const before = target.value;
        const sep = !before || /\s$/.test(before) ? '' : target.tagName === 'TEXTAREA' ? '\n' : ' ';
        const after = before + sep + best.text;
        target.value = after;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        if (best.changes.length) {
          const [from, to] = best.changes[0];
          const more = best.changes.length > 1 ? `（ほか${best.changes.length - 1}件）` : '';
          toast(`「${from}」を「${to}」に直しました${more}`, 6000, {
            label: '元に戻す',
            fn: () => {
              if (target.value !== after) return;
              target.value = before + sep + alts[0].trim();
              target.dispatchEvent(new Event('input', { bubbles: true }));
            },
          });
        }
      }
      if (interimEl) interimEl.textContent = VF && interim ? VF.fix(interim, mode).text : interim;
    };
    r.onerror = e => {
      const msg = {
        'not-allowed': 'マイクが許可されていません。ブラウザの設定でマイクを許可してください',
        'service-not-allowed': 'この端末では音声入力が使えません',
        'no-speech': '声が聞き取れませんでした。もう一度押して話してください',
        network: 'ネットにつながっていないと音声入力は使えません',
        'audio-capture': 'マイクが見つかりません',
      }[e.error];
      if (msg) toast(msg, 4500);
    };
    r.onend = () => {
      if (rec === r) { rec = null; recBtn = null; }
      btn.classList.remove('on');
      const s = btn.querySelector('span');
      if (s) s.textContent = '話して入力';
      if (interimEl) interimEl.textContent = '';
    };
    try { r.start(); } catch { r.onend(); toast('音声入力を始められませんでした'); }
  }
  function handleMic(e, root) {
    const b = e.target.closest('[data-mic]');
    if (!b) return false;
    startMic(b, $(`[data-f="${b.dataset.mic}"]`, root), $('.interim', b.closest('.field')));
    return true;
  }

  /* ---------- 写真の文字を読み取る（Tesseract.js。写真はスマホの中だけで処理する） ---------- */
  const OCR_BASE = new URL('ocr/', location.href).href;
  let ocrWorker = null, ocrLang = null, ocrLog = null, ocrTarget = null;
  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('load'));
    document.head.append(s);
  });
  async function getOcrWorker(lang) {
    if (!window.Tesseract) await loadScript(OCR_BASE + 'tesseract.min.js');
    if (!ocrWorker) {
      ocrWorker = await window.Tesseract.createWorker(lang, 1, {
        workerPath: OCR_BASE + 'worker.min.js',
        corePath: OCR_BASE + 'core',
        langPath: OCR_BASE + 'lang',
        workerBlobURL: false,
        logger: m => ocrLog?.(m),
      });
      ocrLang = lang;
    } else if (ocrLang !== lang) {
      await ocrWorker.reinitialize(lang, 1);
      ocrLang = lang;
    }
    // 区切り方：横書きは自動（写真と文章が混ざるページ向け）、縦書きは「縦に並んだ1かたまり」
    await ocrWorker.setParameters({ tessedit_pageseg_mode: lang === 'jpn_vert' ? '5' : '3' });
    return ocrWorker;
  }
  // 読み取りやすい大きさにする（長い辺 2000px まで。透明な部分は白に）
  async function ocrCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url; });
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }
  // 日本語・数字・かっこの間に入る空白を詰め、音声入力と同じ料理のことばの辞書で整える
  // （「大 さじ 2」→「大さじ2」、「豚肉 二百グラム」→「豚肉 200g」。材料と分量の間の空白は辞書側で入れ直す）
  const JCHAR = '[\\u3000-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef々〆ヶ0-9()]';
  const JGAP = new RegExp(`(?<=${JCHAR})[ \\t]+(?=${JCHAR})`, 'g');
  function cleanOcr(text) {
    return text.split('\n').map(l => l.replace(JGAP, '').trim()).filter(Boolean)
      .map(l => (window.VoiceFix ? window.VoiceFix.fix(l, 'recipe').text : l))
      .join('\n');
  }
  function openOcrMenu(insert) {
    ocrTarget = insert;
    const dir = S.ocrDir === 'v' ? 'v' : 'h';
    const l = openSheet(`<h3>写真の文字を読み取る</h3>
      <p class="hint">料理本・レシピカード・袋の裏など、印刷された文字が向いています。手書きは読み取れないことがあります。</p>
      <div class="f-label">文字の向き</div>
      <div class="seg" data-ocrdir>${[['h', '横書き'], ['v', '縦書き']].map(([v, t]) => `<button data-v="${v}" class="${dir === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="add-choices ocr-choices">
        <button class="choice" data-x="camera">${icon('camera')}<b>カメラで撮る</b></button>
        <button class="choice" data-x="pick">${icon('photos')}<b>写真から選ぶ</b></button></div>`);
    l.el.addEventListener('click', e => {
      const d = e.target.closest('[data-ocrdir] button');
      if (d) {
        S.ocrDir = d.dataset.v;
        saveS();
        $$('[data-ocrdir] button', l.el).forEach(b => b.classList.toggle('on', b === d));
        return;
      }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (!x) return;
      $(x === 'camera' ? '#file-ocr-camera' : '#file-ocr-pick').click();
      back();
    });
  }
  const OCR_STAGE = {
    'loading tesseract core': '読み取りの準備をしています（初めてのときは数MBを読み込みます）',
    'initializing tesseract': '読み取りの準備をしています',
    'loading language traineddata': '日本語のデータを読み込んでいます',
    'initializing api': '読み取りの準備をしています',
    'recognizing text': '文字を読み取っています',
  };
  async function runOcr(file) {
    const insert = ocrTarget;
    if (!insert) return;
    const lang = S.ocrDir === 'v' ? 'jpn_vert' : 'jpn';
    const url = URL.createObjectURL(file);
    let closed = false;
    const l = openSheet(`<h3>写真の文字を読み取る</h3>
      <div class="add-prev"><img src="${url}" alt=""></div>
      <p class="hint ocr-st" data-st>準備しています…</p>
      <div class="progress"><i></i></div>
      <div data-res hidden>
        <div class="field"><div class="f-label">読み取った文字（直してから入れられます）</div><textarea class="inp recipe" data-f="ocr" rows="8"></textarea></div>
        <div class="btn-row sticky"><button class="btn" data-x="cancel">やめる</button><button class="btn primary" data-x="insert">レシピに入れる</button></div>
      </div>`, { cls: 'has-sticky', onClose: () => { closed = true; ocrLog = null; URL.revokeObjectURL(url); } });
    const sh = l.el, st = $('[data-st]', sh), bar = $('.progress i', sh);
    ocrLog = m => {
      if (closed) return;
      if (OCR_STAGE[m.status]) st.textContent = OCR_STAGE[m.status] + (m.status === 'recognizing text' ? `… ${Math.round((m.progress || 0) * 100)}%` : '…');
      if (typeof m.progress === 'number') bar.style.width = `${Math.round(m.progress * 100)}%`;
    };
    sh.addEventListener('click', e => {
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'cancel') back();
      if (x === 'insert') {
        const t = $('[data-f="ocr"]', sh).value.trim();
        back();
        if (t) { insert(t); toast('レシピに入れました'); }
      }
    });
    let text;
    try {
      const canvas = await ocrCanvas(file);
      const w = await getOcrWorker(lang);
      if (closed) return;
      const r = await w.recognize(canvas);
      text = cleanOcr(r.data.text || '');
    } catch {
      try { await ocrWorker?.terminate(); } catch { /* もう止まっている */ }
      ocrWorker = null; ocrLang = null;
      if (closed) return;
      $('.progress', sh).hidden = true;
      st.textContent = navigator.onLine === false
        ? '読み取りの準備ができませんでした。初めて使うときは、ネットにつないでください。'
        : '読み取れませんでした。もう一度お試しください。';
      return;
    }
    if (closed) return;
    $('.progress', sh).hidden = true;
    st.textContent = text
      ? '読み取りました。違うところを直してから「レシピに入れる」を押してください。'
      : '文字が見つかりませんでした。明るい場所で、文字が大きく写るように撮ってみてください。';
    $('[data-res]', sh).hidden = false;
    $('[data-f="ocr"]', sh).value = text;
  }

  /* ---------- 写真の読み込み ---------- */
  // JPEG の Exif から撮影日時を読む（なければ null）
  async function exifDate(file) {
    try {
      const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
      if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
      let o = 2;
      while (o + 4 <= v.byteLength) {
        const marker = v.getUint16(o);
        if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
        const len = v.getUint16(o + 2);
        if (marker === 0xFFE1 && o + 10 <= v.byteLength && v.getUint32(o + 4) === 0x45786966) return parseTiffDate(v, o + 10);
        o += 2 + len;
      }
    } catch { /* 読めない形式 */ }
    return null;
  }
  function parseTiffDate(v, t) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
    const ifd = off => { const tags = {}, n = u16(t + off); for (let i = 0; i < n; i++) { const e = t + off + 2 + i * 12; tags[u16(e)] = e; } return tags; };
    const str = e => { const n = u32(e + 4), p = n > 4 ? t + u32(e + 8) : e + 8; let s = ''; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
    const ifd0 = ifd(u32(t + 4));
    let s = null;
    if (ifd0[0x8769]) { const ex = ifd(u32(ifd0[0x8769] + 8)); if (ex[0x9003]) s = str(ex[0x9003]); }
    if (!s && ifd0[0x0132]) s = str(ifd0[0x0132]);
    const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    return isNaN(d) ? null : d;
  }
  async function takenTime(file) {
    const now = Date.now(), ex = await exifDate(file);
    if (ex && ex > Date.UTC(2000, 0) && ex < now + DAY) return ex;
    return file.lastModified && file.lastModified < now + DAY ? file.lastModified : now;
  }
  const toJpeg = (c, q) => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q));
  // 保存用（長い辺 1600px / 高画質 2560px）と一覧用の正方形サムネイルを作る
  async function makeImages(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url; });
      const W = img.naturalWidth, H = img.naturalHeight;
      const k = Math.min(1, (S.quality === 'high' ? 2560 : 1600) / Math.max(W, H));
      const c = document.createElement('canvas');
      c.width = Math.round(W * k); c.height = Math.round(H * k);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      const full = await toJpeg(c, 0.85);
      const T = 360, s = Math.min(W, H);
      const tc = document.createElement('canvas');
      tc.width = tc.height = T;
      const tg = tc.getContext('2d');
      tg.imageSmoothingQuality = 'high';
      tg.drawImage(img, (W - s) / 2, (H - s) / 2, s, s, 0, 0, T, T);
      const thumb = await toJpeg(tc, 0.8);
      return { full, thumb, w: c.width, h: c.height };
    } finally { URL.revokeObjectURL(url); }
  }
  async function prepare(file) {
    const t = await takenTime(file);
    const im = await makeImages(file);
    const meal = Object.assign(blankMeal(), { takenAt: t, w: im.w, h: im.h, thumb: im.thumb });
    return { meal, full: im.full };
  }
  const readError = e => (e?.name === 'QuotaExceededError' ? 'スマホの空き容量が足りません' : 'この写真は読み込めませんでした');

  async function addFiles(files) {
    files = files.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name));
    if (!files.length) return;
    if (files.length === 1) return openAddSheet(files[0]);
    let ok = 0, ng = 0, lastErr = null;
    const t = toast(`追加しています… 0/${files.length}`, 0);
    for (const f of files) {
      try { await saveNew(await prepare(f)); ok++; } catch (e) { ng++; lastErr = e; }
      t.update(`追加しています… ${ok + ng}/${files.length}`);
    }
    refresh();
    toast(`${ok}枚を追加しました${ng ? `（${ng}枚は${readError(lastErr) === 'スマホの空き容量が足りません' ? '空き容量不足で' : '読み込めず'}追加できませんでした）` : ''}`, 4000);
    requestPersist();
  }


  async function openAddSheet(file) {
    const t = toast('写真を読み込んでいます…', 0);
    let p;
    try { p = await prepare(file); } catch (e) { t.close(); toast(readError(e), 4000); return; }
    t.close();
    const m = p.meal, url = URL.createObjectURL(p.full);
    const l = openSheet(`
      <h3>食事を記録</h3>
      <div class="add-prev"><img src="${url}" alt=""></div>
      <div class="field"><div class="f-label">日時</div><input type="datetime-local" class="inp" data-f="date" value="${toInput(m.takenAt)}"></div>
      <div class="field"><div class="f-label">アルバム（いくつでも・なくてもOK）</div>${quickChipsHTML(m)}</div>
      <div class="field"><div class="f-label">メモ（なくてもOK）${micHTML('memo')}</div><textarea class="inp" data-f="memo" rows="2" maxlength="1000" placeholder="味の感想、量など"></textarea><div class="interim"></div></div>
      <div class="btn-row sticky"><button class="btn" data-x="cancel">やめる</button><button class="btn primary" data-x="save">保存</button></div>`,
    { cls: 'has-sticky', onClose: () => { stopMic(); URL.revokeObjectURL(url); } });
    const sh = l.el;
    sh.addEventListener('change', e => {
      if (e.target.dataset.f !== 'date') return;
      const nt = fromInput(e.target.value);
      if (nt !== null) m.takenAt = nt;
    });
    sh.addEventListener('click', async e => {
      if (handleMic(e, sh)) return;
      const chip = e.target.closest('.chips[data-f="quick"] .chip');
      if (chip) {
        const k = chip.dataset.v;
        setQuick(m, k, !inQuick(m, k));
        chip.classList.toggle('on', inQuick(m, k));
        return;
      }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'cancel') back();
      if (x === 'save') {
        e.target.disabled = true;
        stopMic();
        m.memo = $('[data-f="memo"]', sh).value.trim();
        try { await saveNew(p); } catch (err) { e.target.disabled = false; toast(readError(err), 4000); return; }
        back();
        refresh();
        toast('保存しました');
        requestPersist();
      }
    });
  }


  /* ---------- 一覧（グリッド） ---------- */
  function groupMeals(list, by) {
    const out = [];
    let cur = null;
    for (const m of list) {
      const k = by === 'day' ? dayKey(m.takenAt) : by === 'month' ? monthKey(m.takenAt) : 'all';
      if (!cur || cur.k !== k) out.push(cur = { k, t: m.takenAt, items: [] });
      cur.items.push(m);
    }
    return out;
  }
  function groupHead(g, by) {
    if (by === 'none') return '';
    const cnt = `<span class="cnt">${g.items.length}枚</span>`;
    if (by === 'month') { const d = new Date(g.t); return `<h3 class="grp-h">${d.getFullYear()}年${d.getMonth() + 1}月${cnt}</h3>`; }
    const x = dayTitle(g.t);
    return `<h3 class="grp-h">${x.main}${x.sub ? `<small>${x.sub}</small>` : ''}${cnt}</h3>`;
  }
  function tileHTML(m, extra = '') {
    return `<button class="tile" data-id="${m.id}"><img src="${thumbURL(m)}" alt="" loading="lazy" decoding="async">`
      + (m.fav ? `<span class="tfav">${icon('heart')}</span>` : '')
      + `${extra}<span class="tsel">${icon('check')}</span></button>`;
  }
  function renderGrid(box, list, by = 'day') {
    box._list = list;
    box.innerHTML = groupMeals(list, by).map(g => `<section class="grp">${groupHead(g, by)}<div class="grid">${g.items.map(m => tileHTML(m)).join('')}</div></section>`).join('');
    if (sel.on && sel.box === box) {
      // 一覧から消えた写真（お気に入りから外した・ごみ箱に入れた など）は、選んだものからも外す
      const shown = new Set(list.map(m => m.id));
      sel.ids = new Set([...sel.ids].filter(id => shown.has(id)));
      $$('.tile', box).forEach(t => t.classList.toggle('selected', sel.ids.has(t.dataset.id)));
      toggleSel(null);
    }
  }
  // タップで詳細、長押しで選択モード
  function bindGrid(box) {
    let timer, sx = 0, sy = 0, fired = false;
    const cancel = () => clearTimeout(timer);
    box.addEventListener('pointerdown', e => {
      const t = e.target.closest('.tile');
      if (!t) return;
      fired = false; sx = e.clientX; sy = e.clientY;
      cancel();
      timer = setTimeout(() => {
        fired = true;
        if (!sel.on) startSelect(box, t.dataset.id); else if (sel.box === box) toggleSel(t.dataset.id);
        navigator.vibrate?.(15);
      }, 450);
    });
    box.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) cancel(); });
    box.addEventListener('pointerup', cancel);
    box.addEventListener('pointercancel', cancel);
    box.addEventListener('contextmenu', e => { if (e.target.closest('.tile')) e.preventDefault(); });
    box.addEventListener('click', e => {
      const t = e.target.closest('.tile');
      if (!t) return;
      if (fired) { fired = false; return; }
      if (sel.on) { if (sel.box === box) toggleSel(t.dataset.id); return; }
      const list = box._list || [], i = list.findIndex(m => m.id === t.dataset.id);
      if (i >= 0) openViewer(list, i);
    });
  }

  /* ---------- 選択モード ---------- */
  const sel = { on: false, box: null, ids: new Set() };
  function startSelect(box, id) {
    sel.on = true; sel.box = box; sel.ids = new Set();
    box.classList.add('sel-mode');
    document.body.classList.add('selecting');
    toggleSel(id);
    pushLayer({ close: endSelect });
  }
  function endSelect() {
    if (sel.box) { sel.box.classList.remove('sel-mode'); $$('.tile.selected', sel.box).forEach(t => t.classList.remove('selected')); }
    document.body.classList.remove('selecting');
    sel.on = false; sel.box = null; sel.ids = new Set();
  }
  function toggleSel(id) {
    if (id) {
      sel.ids.has(id) ? sel.ids.delete(id) : sel.ids.add(id);
      $$(`.tile[data-id="${id}"]`, sel.box).forEach(t => t.classList.toggle('selected', sel.ids.has(id)));
    }
    $('#sel-count').textContent = sel.ids.size ? `${sel.ids.size}件を選択` : '写真を選択';
  }
  function bindSelection() {
    $('#selbar').addEventListener('click', e => {
      const s = e.target.closest('[data-s]')?.dataset.s;
      if (s === 'close') back();
      if (s === 'all') {
        const list = sel.box?._list || [];
        const all = list.length && list.every(m => sel.ids.has(m.id));
        sel.ids = new Set(all ? [] : list.map(m => m.id));
        $$('.tile', sel.box).forEach(t => t.classList.toggle('selected', sel.ids.has(t.dataset.id)));
        toggleSel(null);
      }
    });
    $('#selactions').addEventListener('click', async e => {
      const s = e.target.closest('[data-s]')?.dataset.s;
      if (!s) return;
      const ids = [...sel.ids];
      if (!ids.length) { toast('写真をタップして選んでください'); return; }
      if (s === 'album') openAlbumPicker(ids);
      if (s === 'share') {
        const ms = state.meals.filter(m => sel.ids.has(m.id));
        const files = await Promise.all(ms.map(async m => new File([await fullBlob(m.id)], fileName(m), { type: 'image/jpeg' })));
        shareFiles(files);
      }
      if (s === 'del') back(() => trashMeals(ids));
      if (s === 'fav') {
        // 選んだ写真が全部お気に入りなら全部外し、そうでなければ全部お気に入りにする（選んだ状態はそのまま）
        const ms = state.meals.filter(m => sel.ids.has(m.id)), all = ms.every(m => m.fav);
        for (const m of ms) { m.fav = !all; await saveMeal(m); }
        refresh();
        toast(all ? `${ms.length}枚をお気に入りから外しました` : `${ms.length}枚をお気に入りにしました`);
      }
    });
  }

  /* ---------- 共有・保存 ---------- */
  function fileName(m) {
    const d = new Date(m.takenAt);
    return `${dayKey(m.takenAt)}_${pad(d.getHours())}${pad(d.getMinutes())}_${m.id.slice(-4)}.jpg`;
  }
  async function shareFiles(files) {
    if (!navigator.canShare?.({ files })) { toast('この端末では共有できません'); return; }
    try { await navigator.share({ files }); } catch (e) {
      if (e.name === 'NotAllowedError') toast('共有の準備ができました', 6000, { label: '共有する', fn: () => navigator.share({ files }).catch(() => {}) });
    }
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  /* ---------- 写真の詳細 ---------- */
  function openViewer(list, index) {
    list = list.slice();
    let i = index, cur = null, fullURL = null, curBlob = null, seq = 0, meta = '';
    const el = h(`<div class="screen viewer">
      <div class="v-top">
        <button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button>
        <div class="v-title"><b></b><span></span></div>
        <button class="icon-btn" data-act="more" aria-label="その他">${icon('more')}</button>
      </div>
      <div class="v-scroll">
        <div class="v-stage"><img class="v-img" alt=""><div class="v-hint">${icon('up')}<span>上にスワイプで詳細</span></div></div>
        <div class="v-info"></div>
      </div>
      <div class="v-actions">
        <button data-act="fav" aria-label="お気に入り">${icon('heart')}</button>
        <button data-act="edit" aria-label="メモを書く">${icon('edit')}</button>
        <button data-act="share" aria-label="共有">${icon('share')}</button>
        <button data-act="del" aria-label="削除">${icon('trash')}</button>
      </div>
    </div>`);
    const img = $('.v-img', el), info = $('.v-info', el), scroller = $('.v-scroll', el), stage = $('.v-stage', el);
    img.onload = () => { img.style.opacity = 1; };

    async function show(n) {
      i = n; cur = list[i];
      const my = ++seq;
      curBlob = null; meta = '';
      img.style.transition = 'none';
      img.style.opacity = 0;
      img.style.transform = '';
      img.getBoundingClientRect();
      img.style.transition = '';
      renderHead();
      renderInfo();
      const b = await fullBlob(cur.id);
      if (my !== seq || !b) return;
      curBlob = b;
      if (fullURL) URL.revokeObjectURL(fullURL);
      fullURL = URL.createObjectURL(b);
      img.src = fullURL;
      meta = `${cur.w}×${cur.h}・${fmtSize(b.size)}`;
      const mt = $('.meta', info);
      if (mt) mt.textContent = meta;
    }
    function renderHead() {
      $('.v-title b', el).textContent = md(cur.takenAt);
      $('.v-title span', el).textContent = hm(cur.takenAt);
      $('[data-act="fav"]', el).classList.toggle('on', !!cur.fav);
    }
    function renderInfo() {
      stopMic();
      const m = cur;
      const dayList = live().filter(x => dayKey(x.takenAt) === dayKey(m.takenAt)).sort((a, b) => a.takenAt - b.takenAt);
      const albums = state.albums.filter(a => m.albums.includes(a.id));
      info.innerHTML = `
        <div class="info-date"><div><b>${md(m.takenAt, true)}</b><span>${hm(m.takenAt)}</span></div>
          <span class="date-edit">日時を変更<input type="datetime-local" data-f="date" value="${toInput(m.takenAt)}" aria-label="日時"></span></div>
        <div class="field"><div class="f-label">アルバム（いくつでも選べます）</div>${quickChipsHTML(m)}
          <div class="chips mine">${albums.map(a => `<span class="chip in">${icon('albums')}${esc(a.name)}</span>`).join('')}<button class="chip add" data-act="album">＋ 自分のアルバムに追加</button></div></div>
        <div class="field"><div class="f-label">お店・場所</div><input class="inp" data-f="place" maxlength="60" placeholder="例：〇〇食堂、職場" value="${esc(m.place)}"></div>
        <div class="field"><div class="f-label">メモ${micHTML('memo')}</div><textarea class="inp" data-f="memo" rows="3" maxlength="1000" placeholder="味の感想、量、体調など">${esc(m.memo)}</textarea><div class="interim"></div></div>
        <div class="field"><div class="f-label">レシピ${micHTML('recipe')}</div><textarea class="inp recipe" data-f="recipe" rows="5" maxlength="5000" placeholder="材料や作り方など&#10;例）豚肉 200g、玉ねぎ 1個…">${esc(m.recipe)}</textarea><div class="interim"></div>
          <button class="chip add ocr" data-act="ocr">${icon('camera')}写真の文字を読み取る</button></div>
        <div class="field"><div class="f-label">タグ</div><div class="chips">${m.tags.map(t => `<span class="chip tag">#${esc(t)}<button data-rm="${esc(t)}" aria-label="タグを外す">${icon('close')}</button></span>`).join('')}<button class="chip add" data-act="tag">＃タグを追加</button></div></div>
        ${dayList.length > 1 ? `<div class="field"><div class="f-label">この日の食事</div><div class="strip">${dayList.map(x => `<button data-jump="${x.id}" class="${x.id === m.id ? 'cur' : ''}"><img src="${thumbURL(x)}" alt=""></button>`).join('')}</div></div>` : ''}
        <div class="meta">${esc(meta)}</div>`;
    }
    function addTagInline() {
      const btn = $('[data-act="tag"]', info);
      const inp = h('<input class="inp tag-inp" maxlength="20" placeholder="タグを入れて決定" enterkeyhint="done">');
      btn.replaceWith(inp);
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); inp.blur(); } });
      inp.addEventListener('blur', async () => {
        const vals = inp.value.split(/[\s,、，#＃]+/).map(s => s.trim()).filter(Boolean);
        const add = vals.filter(v => !cur.tags.includes(v));
        if (add.length) { cur.tags.push(...add); await saveMeal(cur); }
        renderInfo();
      }, { once: true });
    }

    info.addEventListener('click', async e => {
      if (handleMic(e, info)) return;
      const chip = e.target.closest('.chips[data-f="quick"] .chip');
      if (chip) {
        const k = chip.dataset.v;
        setQuick(cur, k, !inQuick(cur, k));
        chip.classList.toggle('on', inQuick(cur, k));
        await saveMeal(cur);
        renderHead();
        refresh();
        return;
      }
      const rm = e.target.closest('[data-rm]');
      if (rm) { cur.tags = cur.tags.filter(t => t !== rm.dataset.rm); await saveMeal(cur); renderInfo(); return; }
      const jump = e.target.closest('[data-jump]');
      if (jump) {
        let k = list.findIndex(x => x.id === jump.dataset.jump);
        if (k < 0) {
          list = live().filter(x => dayKey(x.takenAt) === dayKey(cur.takenAt)).sort((a, b) => a.takenAt - b.takenAt);
          k = list.findIndex(x => x.id === jump.dataset.jump);
        }
        if (k >= 0) { scroller.scrollTo({ top: 0, behavior: 'smooth' }); show(k); }
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'tag') addTagInline();
      if (act === 'album') openAlbumPicker([cur.id], renderInfo);
      if (act === 'ocr') {
        const m = cur;
        openOcrMenu(text => {
          m.recipe = m.recipe + (m.recipe && !/\n$/.test(m.recipe) ? '\n' : '') + text;
          saveMeal(m);
          refresh();
          if (cur === m) { const ta = $('[data-f="recipe"]', info); if (ta) ta.value = m.recipe; }
        });
      }
    });
    info.addEventListener('input', e => {
      const f = e.target.dataset.f;
      if (f === 'place' || f === 'memo' || f === 'recipe') { cur[f] = e.target.value; queueSave(cur); }
    });
    info.addEventListener('change', async e => {
      if (e.target.dataset.f !== 'date') return;
      const t = fromInput(e.target.value);
      if (t === null) return;
      cur.takenAt = t;
      await saveMeal(cur);
      sortMeals();
      renderHead();
      renderInfo();
      refresh();
    });

    // 左右スワイプで前後の写真、タップで写真だけの表示
    let sx = 0, sy = 0, dx = 0, mode = null;
    stage.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; mode = null;
      img.style.transition = 'none';
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
      if (!mode) { if (Math.abs(x) > 10 && Math.abs(x) > Math.abs(y)) mode = 'h'; else if (Math.abs(y) > 10) mode = 'v'; }
      if (mode === 'h') {
        e.preventDefault();
        dx = x;
        const edge = (i === 0 && x > 0) || (i === list.length - 1 && x < 0);
        img.style.transform = `translateX(${edge ? x / 3 : x}px)`;
      }
    }, { passive: false });
    stage.addEventListener('touchend', () => {
      img.style.transition = '';
      if (mode === 'h') {
        if (dx < -70 && i < list.length - 1) slide(1);
        else if (dx > 70 && i > 0) slide(-1);
        else img.style.transform = '';
      }
      mode = null;
    });
    function slide(d) {
      img.style.transform = `translateX(${d > 0 ? -100 : 100}%)`;
      img.style.opacity = 0;
      setTimeout(() => show(i + d), 170);
    }
    stage.addEventListener('click', () => el.classList.toggle('immersive'));
    const onKey = e => {
      if (topLayer() !== layer || typing(e.target)) return;
      if (e.key === 'ArrowRight' && i < list.length - 1) show(i + 1);
      if (e.key === 'ArrowLeft' && i > 0) show(i - 1);
    };
    document.addEventListener('keydown', onKey);

    el.addEventListener('click', async e => {
      const act = e.target.closest('.v-top [data-act], .v-actions [data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'fav') { cur.fav = !cur.fav; await saveMeal(cur); renderHead(); refresh(); }
      if (act === 'edit') {
        scroller.scrollTo({ top: stage.offsetHeight - 24, behavior: 'smooth' });
        setTimeout(() => $('[data-f="memo"]', info)?.focus({ preventScroll: true }), 380);
      }
      if (act === 'share') {
        if (!curBlob) return;
        shareFiles([new File([curBlob], fileName(cur), { type: 'image/jpeg' })]);
      }
      if (act === 'del') {
        const m = cur;
        m.deletedAt = Date.now();
        await saveMeal(m);
        list.splice(i, 1);
        refresh();
        toast('ごみ箱に移動しました', 4500, { label: '元に戻す', fn: () => restoreMeals([m.id]) });
        if (!list.length) back(); else show(Math.min(i, list.length - 1));
      }
      if (act === 'more') {
        const l = openSheet(`<div class="sheet-list">
          <button data-x="save">${icon('backup')}スマホに保存</button>
          <button data-x="album">${icon('albums')}アルバムに追加</button></div>`);
        l.el.addEventListener('click', ev => {
          const x = ev.target.closest('[data-x]')?.dataset.x;
          if (x === 'save') { if (curBlob) download(curBlob, fileName(cur)); back(); }
          if (x === 'album') back(() => openAlbumPicker([cur.id], renderInfo));
        });
      }
    });

    const layer = pushScreen(el, {
      refresh: () => { if (cur) renderHead(); },
      onClose() {
        stopMic();
        flushNow();
        seq++;
        document.removeEventListener('keydown', onKey);
        if (fullURL) URL.revokeObjectURL(fullURL);
        refresh();
      },
    });
    show(i);
  }

  /* ---------- 写真タブ ---------- */
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let installEvt = null;
  function bannerHTML() {
    if (!standalone && !S.hideInstall) {
      return `<div class="banner"><b>ホーム画面に追加しましょう</b>アプリのようにすぐ開けて、写真も消えにくくなります。<div class="row"><button class="btn sm primary" data-a="install">${installEvt ? '追加する' : '追加のしかた'}</button><button class="btn sm" data-a="hide-install">閉じる</button></div></div>`;
    }
    const L = live();
    if (L.length < 10 || Date.now() < S.snooze) return '';
    const oldest = L.reduce((a, m) => Math.min(a, m.createdAt || m.takenAt), Infinity);
    const need = S.lastBackup ? Date.now() - S.lastBackup > 30 * DAY : Date.now() - oldest > 14 * DAY;
    if (!need) return '';
    return `<div class="banner"><b>${S.lastBackup ? '前回のバックアップから1か月たちました' : 'バックアップを作っておきましょう'}</b>写真はこのスマホの中だけに保存されています。<div class="row"><button class="btn sm primary" data-a="backup">バックアップを作る</button><button class="btn sm" data-a="snooze">あとで</button></div></div>`;
  }
  function renderPhotos() {
    const L = live();
    $('#banner').innerHTML = bannerHTML();
    renderGrid($('#photos-grid'), L, 'day');
    $('#photos-empty').hidden = L.length > 0;
  }
  function photosMore() {
    const l = openSheet(`<div class="sheet-list">
      <button data-x="select">${icon('check')}写真を選択</button>
      <button data-x="settings">${icon('settings')}設定</button></div>
      <div class="f-label" style="margin:12px 6px 8px">1行に並べる枚数</div>
      <div class="seg">${[2, 3, 4, 5].map(n => `<button data-cols="${n}" class="${S.cols === n ? 'on' : ''}">${n}</button>`).join('')}</div>`);
    l.el.addEventListener('click', e => {
      const c = e.target.closest('[data-cols]');
      if (c) { S.cols = +c.dataset.cols; saveS(); applyCols(); $$('[data-cols]', l.el).forEach(b => b.classList.toggle('on', b === c)); return; }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'select') back(() => { if (live().length) startSelect($('#photos-grid'), null); });
      if (x === 'settings') back(openSettings);
    });
  }
  // 2本指でつまむと1行の枚数が変わる
  function bindPinch(el) {
    let d0 = 0;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    el.addEventListener('touchstart', e => { if (e.touches.length === 2) d0 = dist(e.touches); }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !d0) return;
      const r = dist(e.touches) / d0;
      if (r > 1.35 && S.cols > 2) { S.cols--; d0 = dist(e.touches); applyCols(); saveS(); }
      else if (r < 0.7 && S.cols < 5) { S.cols++; d0 = dist(e.touches); applyCols(); saveS(); }
    }, { passive: true });
    el.addEventListener('touchend', () => { d0 = 0; });
  }

  /* ---------- アルバム ---------- */
  // アルバムタブの「よく見るアルバム」（2列。ユーザー指定の並び）
  //   ママごはん | パパごはん / お弁当 | 外食 / レシピ | スイーツ / お気に入り
  const quickAlbum = k => { const q = QUICK.find(x => x.k === k); return { id: qid(k), name: q.label, icon: q.icon, f: m => inQuick(m, k) }; };
  const SMART = [
    quickAlbum('mama'), quickAlbum('papa'),
    quickAlbum('bento'), quickAlbum('out'),
    { id: 'recipe', name: 'レシピ', icon: 'recipe', f: m => !!m.recipe.trim() }, quickAlbum('sweets'),
    { id: 'fav', name: 'お気に入り', icon: 'heart', f: m => m.fav },
  ];
  function albumDef(id) {
    const s = SMART.find(a => a.id === id);
    if (s) return s;
    const a = state.albums.find(x => x.id === id);
    return a ? { id, name: a.name, custom: true, icon: 'albums', f: m => m.albums.includes(id) } : null;
  }
  function albumCard(def, L) {
    const list = L.filter(def.f), cover = list[0];
    return `<button class="acard ${cover ? '' : 'empty'}" data-album="${esc(def.id)}">`
      + (cover ? `<img src="${thumbURL(cover)}" alt="" loading="lazy">` : `<span class="aph">${icon(def.icon || 'photos')}</span>`)
      + `<span class="alabel"><b>${esc(def.name)}</b><small>${list.length}</small></span></button>`;
  }
  function renderAlbums() {
    const L = live();
    $('#albums-smart').innerHTML = SMART.map(d => albumCard(d, L)).join('');
    $('#albums-mine').innerHTML = state.albums.map(a => albumCard(albumDef(a.id), L)).join('')
      + `<button class="acard new" data-new>${icon('plus')}<span>新しいアルバム</span></button>`;
  }
  async function newAlbum() {
    const name = await askText({ title: '新しいアルバム', placeholder: '例：ラーメン、旅行', ok: '作る' });
    if (!name) return;
    await createAlbum(name);
    refresh();
    toast('作りました。写真を長押しすると、まとめて追加できます', 4500);
  }
  function openAlbum(id) {
    const el = h(`<div class="screen album-screen">
      <div class="a-top"><button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button><h2></h2><button class="icon-btn" data-x="more" aria-label="その他" hidden>${icon('more')}</button></div>
      <div class="a-hero"><div class="a-hero-text"><h2></h2><p></p></div></div>
      <div class="a-grid"></div>
      <div class="empty" hidden>${icon('bowl')}<p>このアルバムにはまだ写真がありません</p></div>
    </div>`);
    const grid = $('.a-grid', el), hero = $('.a-hero', el);
    bindGrid(grid);
    let heroURL = null, heroId = null;
    function setHero(m) {
      let img = $('img', hero);
      if (!m) { img?.remove(); heroId = null; return; }
      if (heroId === m.id) return;
      heroId = m.id;
      if (!img) { img = document.createElement('img'); img.alt = ''; hero.prepend(img); }
      img.src = thumbURL(m);
      fullBlob(m.id).then(b => {
        if (!b || heroId !== m.id) return;
        if (heroURL) URL.revokeObjectURL(heroURL);
        heroURL = URL.createObjectURL(b);
        img.src = heroURL;
      });
    }
    function render() {
      const def = albumDef(id);
      if (!def) return;
      const list = live().filter(def.f);
      $$('h2', el).forEach(x => { x.textContent = def.name; });
      $('.a-hero p', el).textContent = `写真 ${list.length}枚`;
      el.classList.toggle('noimg', !list.length);
      setHero(list[0]);
      renderGrid(grid, list, 'month');
      $('.empty', el).hidden = list.length > 0;
      $('[data-x="more"]', el).hidden = !def.custom;
    }
    el.addEventListener('click', e => {
      if (!e.target.closest('[data-x="more"]')) return;
      const l = openSheet(`<div class="sheet-list">
        <button data-y="rename">${icon('edit')}名前を変更</button>
        <button data-y="delete" class="danger">${icon('trash')}アルバムを削除</button></div>`);
      l.el.addEventListener('click', ev => {
        const y = ev.target.closest('[data-y]')?.dataset.y;
        if (!y) return;
        back(async () => {
          const a = state.albums.find(x => x.id === id);
          if (!a) return;
          if (y === 'rename') {
            const name = await askText({ title: '名前を変更', value: a.name, ok: '変更' });
            if (name) { a.name = name; await db.put('albums', a); refresh(); }
          } else if (await ask({ title: `「${a.name}」を削除しますか？`, msg: 'アルバムだけを削除します。写真は消えません。', ok: '削除', danger: true })) {
            await deleteAlbum(id);
            back();
          }
        });
      });
    });
    render();
    pushScreen(el, { refresh: render, onClose: () => { if (heroURL) URL.revokeObjectURL(heroURL); } });
    new IntersectionObserver(([en]) => el.classList.toggle('collapsed', !en.isIntersecting), { root: el, rootMargin: '-64px 0px 0px 0px' }).observe(hero);
  }
  function openAlbumPicker(ids, onChange) {
    const set = new Set(ids);
    const ms = state.meals.filter(m => set.has(m.id));
    const l = openSheet(`<h3>アルバムに追加</h3><div class="pick-list"></div><button class="btn block" data-x="new">${icon('plus')}新しいアルバムを作る</button>`);
    const box = $('.pick-list', l.el);
    const row = (attr, n, name) => `<button class="pick ${n === ms.length ? 'on' : n ? 'part' : ''}" ${attr}><span class="pk">${icon('check')}</span>${esc(name)}</button>`;
    function render() {
      box.innerHTML = QUICK.map(q => row(`data-quick="${q.k}"`, ms.filter(m => inQuick(m, q.k)).length, q.label)).join('')
        + row('data-fav', ms.filter(m => m.fav).length, 'お気に入り')
        + state.albums.map(a => row(`data-id="${a.id}"`, ms.filter(m => m.albums.includes(a.id)).length, a.name)).join('');
    }
    render();
    l.el.addEventListener('click', async e => {
      const q = e.target.closest('.pick[data-quick]');
      if (q) {
        // 選んだ写真が全部入っていれば外し、そうでなければ全部に入れる
        const k = q.dataset.quick, all = ms.every(m => inQuick(m, k));
        for (const m of ms) { setQuick(m, k, !all); await saveMeal(m); }
        render(); refresh(); onChange?.();
        return;
      }
      if (e.target.closest('.pick[data-fav]')) {
        const all = ms.every(m => m.fav);
        for (const m of ms) { m.fav = !all; await saveMeal(m); }
        render(); refresh(); onChange?.();
        return;
      }
      const p = e.target.closest('.pick[data-id]');
      if (p) {
        const id = p.dataset.id, all = ms.every(m => m.albums.includes(id));
        for (const m of ms) {
          if (all) m.albums = m.albums.filter(x => x !== id);
          else if (!m.albums.includes(id)) m.albums.push(id);
          await saveMeal(m);
        }
        render(); refresh(); onChange?.();
        return;
      }
      if (e.target.closest('[data-x="new"]')) {
        const name = await askText({ title: '新しいアルバム', placeholder: '例：ラーメン、旅行', ok: '作る' });
        if (!name) return;
        const a = await createAlbum(name);
        for (const m of ms) { m.albums.push(a.id); await saveMeal(m); }
        render(); refresh(); onChange?.();
        toast(`「${name}」に追加しました`);
      }
    });
  }

  /* ---------- カレンダー ---------- */
  function renderCalendar() {
    const base = state.calMonth, y = base.getFullYear(), mo = base.getMonth();
    $('#cal-title').textContent = `${y}年${mo + 1}月`;
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    const byDay = new Map();
    for (const m of live()) {
      const d = new Date(m.takenAt);
      if (d.getFullYear() !== y || d.getMonth() !== mo) continue;
      if (!byDay.has(d.getDate())) byDay.set(d.getDate(), []);
      byDay.get(d.getDate()).push(m);
    }
    const todayK = dayKey(Date.now());
    let html = '<div class="cal-cell blank"></div>'.repeat(first), photos = 0;
    for (let d = 1; d <= days; d++) {
      const list = (byDay.get(d) || []).sort((a, b) => a.takenAt - b.takenAt);
      photos += list.length;
      const key = `${y}-${pad(mo + 1)}-${pad(d)}`, wd = (first + d - 1) % 7;
      const cover = list[list.length - 1];
      html += `<button class="cal-cell ${list.length ? 'has' : ''} ${key === todayK ? 'today' : ''} ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}" data-day="${key}" aria-label="${mo + 1}月${d}日 ${list.length}枚">`
        + (cover ? `<img src="${thumbURL(cover)}" alt="" loading="lazy">` : '')
        + `<span class="dn">${d}</span>`
        + (list.length > 1 ? `<span class="cc">${list.length}</span>` : '')
        + '</button>';
    }
    $('#cal-grid').innerHTML = html;
    $('#cal-sum').textContent = byDay.size ? `記録した日 ${byDay.size}日・写真 ${photos}枚` : 'この月の記録はまだありません';
  }
  function moveMonth(n) {
    const b = state.calMonth;
    state.calMonth = new Date(b.getFullYear(), b.getMonth() + n, 1);
    renderCalendar();
  }
  function openDay(key) {
    const [y, mo, d] = key.split('-').map(Number);
    const t0 = new Date(y, mo - 1, d).getTime();
    const el = h(`<div class="screen"><div class="sbar"><button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button><h2>${md(t0)}<span class="sub"></span></h2></div><div class="day-body"></div></div>`);
    const body = $('.day-body', el);
    function render() {
      const list = live().filter(m => dayKey(m.takenAt) === key).sort((a, b) => a.takenAt - b.takenAt);
      body._list = list;
      $('.sub', el).textContent = list.length ? `写真 ${list.length}枚` : '記録なし';
      // 撮った時刻の順に並べる（朝・昼・夜の区切りはなくした）
      body.innerHTML = list.length
        ? `<div class="dcards day">${list.map(m => `<button class="dcard" data-id="${m.id}"><img src="${thumbURL(m)}" alt="" loading="lazy"><div class="dm"><div class="t">${[hm(m.takenAt), ...quickLabels(m)].join('・')}${m.place ? '・' + esc(m.place) : ''}</div>${m.memo ? `<p>${esc(m.memo)}</p>` : ''}${m.recipe.trim() ? '<span class="rc">レシピあり</span>' : ''}</div></button>`).join('')}</div>`
        : '<div class="dnone">この日の記録はありません</div>';
    }
    body.addEventListener('click', e => {
      const c = e.target.closest('.dcard');
      if (!c) return;
      const k = body._list.findIndex(m => m.id === c.dataset.id);
      if (k >= 0) openViewer(body._list, k);
    });
    render();
    pushScreen(el, { refresh: render });
  }

  /* ---------- 検索 ---------- */
  function haystack(m) {
    return [m.memo, m.recipe, m.recipe.trim() && 'レシピ', m.place, ...m.tags, ...quickLabels(m), m.fav && 'お気に入り', md(m.takenAt, true),
      ...state.albums.filter(a => m.albums.includes(a.id)).map(a => a.name)].filter(Boolean).join(' ').toLowerCase();
  }
  function openSearch() {
    const el = h(`<div class="screen">
      <div class="sbar"><button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button><input class="inp search-inp" type="search" placeholder="メモ・お店・タグで探す" enterkeyhint="search" aria-label="検索"></div>
      <div class="s-sugg"></div><div class="s-res"></div><div class="empty" hidden></div></div>`);
    const inp = $('input', el), res = $('.s-res', el), sugg = $('.s-sugg', el), empty = $('.empty', el);
    bindGrid(res);
    function render() {
      const q = inp.value.trim().toLowerCase();
      if (!q) {
        const count = new Map();
        live().forEach(m => m.tags.forEach(t => count.set(t, (count.get(t) || 0) + 1)));
        const tags = [...count].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => '#' + x[0]);
        sugg.innerHTML = `<div class="f-label">よく使う言葉</div><div class="chips">${[...QUICK.map(x => x.label), 'レシピ', 'お気に入り', ...tags].map(w => `<button class="chip" data-w="${esc(w.replace(/^#/, ''))}">${esc(w)}</button>`).join('')}</div>`;
        sugg.hidden = false; res.innerHTML = ''; res._list = []; empty.hidden = true;
        return;
      }
      sugg.hidden = true;
      const terms = q.split(/\s+/);
      const list = live().filter(m => { const s = haystack(m); return terms.every(t => s.includes(t)); });
      renderGrid(res, list, 'day');
      empty.hidden = list.length > 0;
      empty.innerHTML = `${icon('search')}<p>「${esc(inp.value.trim())}」に当てはまる写真はありません</p>`;
    }
    inp.addEventListener('input', debounce(render, 150));
    sugg.addEventListener('click', e => { const w = e.target.closest('[data-w]'); if (w) { inp.value = w.dataset.w; render(); } });
    render();
    pushScreen(el, { refresh: render });
    setTimeout(() => inp.focus(), 320);
  }

  /* ---------- ごみ箱 ---------- */
  function openTrash() {
    const el = h(`<div class="screen">
      <div class="sbar"><button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button><h2>ごみ箱</h2><button class="icon-btn" data-x="more" aria-label="その他">${icon('more')}</button></div>
      <p class="note">削除した写真は、${TRASH_DAYS}日たつと自動で完全に削除されます。</p>
      <div class="t-grid"></div><div class="empty" hidden>${icon('trash')}<p>ごみ箱は空です</p></div></div>`);
    const grid = $('.t-grid', el);
    const trashed = () => state.meals.filter(m => m.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
    function render() {
      const list = trashed();
      grid.innerHTML = `<div class="grid">${list.map(m => {
        const left = Math.max(0, Math.ceil((m.deletedAt + TRASH_DAYS * DAY - Date.now()) / DAY));
        return tileHTML(m, `<span class="left">あと${left}日</span>`);
      }).join('')}</div>`;
      $('.empty', el).hidden = list.length > 0;
      $('[data-x="more"]', el).hidden = !list.length;
    }
    grid.addEventListener('click', e => {
      const t = e.target.closest('.tile');
      const m = t && state.meals.find(x => x.id === t.dataset.id);
      if (!m) return;
      const l = openSheet(`<div class="trash-prev"><img src="${thumbURL(m)}" alt=""></div><p class="hint center">${md(m.takenAt, true)} ${hm(m.takenAt)}</p>
        <div class="btn-row"><button class="btn danger" data-y="del">完全に削除</button><button class="btn primary" data-y="restore">元に戻す</button></div>`);
      l.el.addEventListener('click', ev => {
        const y = ev.target.closest('[data-y]')?.dataset.y;
        if (y === 'restore') back(async () => { await restoreMeals([m.id]); toast('元に戻しました'); });
        if (y === 'del') {
          back(async () => {
            if (!await ask({ title: '完全に削除しますか？', msg: 'この写真は元に戻せなくなります。', ok: '完全に削除', danger: true })) return;
            await hardDelete([m.id]);
            refresh();
          });
        }
      });
    });
    el.addEventListener('click', e => {
      if (!e.target.closest('.sbar [data-x="more"]')) return;
      const l = openSheet(`<div class="sheet-list">
        <button data-y="restore">${icon('undo')}すべて元に戻す</button>
        <button data-y="empty" class="danger">${icon('trash')}ごみ箱を空にする</button></div>`);
      l.el.addEventListener('click', ev => {
        const y = ev.target.closest('[data-y]')?.dataset.y;
        if (!y) return;
        back(async () => {
          const ids = trashed().map(m => m.id);
          if (y === 'restore') { await restoreMeals(ids); toast(`${ids.length}枚を元に戻しました`); return; }
          if (!await ask({ title: 'ごみ箱を空にしますか？', msg: `${ids.length}枚の写真を完全に削除します。元に戻せません。`, ok: '完全に削除', danger: true })) return;
          await hardDelete(ids);
          refresh();
          toast('ごみ箱を空にしました');
        });
      });
    });
    render();
    pushScreen(el, { refresh: render });
  }

  /* ---------- バックアップ（zip・無圧縮） ---------- */
  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  class ZipWriter {
    constructor() { this.parts = []; this.cd = []; this.offset = 0; this.count = 0; }
    async add(name, blob, time = Date.now()) {
      const data = new Uint8Array(await blob.arrayBuffer());
      const crc = crc32(data), nb = new TextEncoder().encode(name), d = new Date(time);
      const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
      const dd = ((Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034B50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
      this.parts.push(lh.buffer, nb, blob);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014B50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true);
      c.setUint32(42, this.offset, true);
      this.cd.push(c.buffer, nb);
      this.offset += 30 + nb.length + data.length;
      this.count++;
    }
    finish() {
      const size = this.cd.reduce((s, p) => s + p.byteLength, 0);
      const e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054B50, true); e.setUint16(8, this.count, true); e.setUint16(10, this.count, true);
      e.setUint32(12, size, true); e.setUint32(16, this.offset, true);
      return new Blob([...this.parts, ...this.cd, e.buffer], { type: 'application/zip' });
    }
  }
  async function readZip(file) {
    const tailLen = Math.min(file.size, 65557);
    const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    let p = -1;
    for (let k = tailLen - 22; k >= 0; k--) if (tail.getUint32(k, true) === 0x06054B50) { p = k; break; }
    if (p < 0) throw new Error('zip');
    const count = tail.getUint16(p + 10, true), size = tail.getUint32(p + 12, true), off = tail.getUint32(p + 16, true);
    const cd = new DataView(await file.slice(off, off + size).arrayBuffer());
    const dec = new TextDecoder(), entries = new Map();
    let o = 0;
    for (let k = 0; k < count; k++) {
      if (cd.getUint32(o, true) !== 0x02014B50) throw new Error('zip');
      const nlen = cd.getUint16(o + 28, true);
      entries.set(dec.decode(new Uint8Array(cd.buffer, o + 46, nlen)), {
        method: cd.getUint16(o + 10, true), size: cd.getUint32(o + 20, true), at: cd.getUint32(o + 42, true),
      });
      o += 46 + nlen + cd.getUint16(o + 30, true) + cd.getUint16(o + 32, true);
    }
    return {
      async blob(name, type = '') {
        const e = entries.get(name);
        if (!e) return null;
        if (e.method !== 0) throw new Error('compressed');
        const lh = new DataView(await file.slice(e.at, e.at + 30).arrayBuffer());
        const start = e.at + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        return new Blob([await file.slice(start, start + e.size).arrayBuffer()], { type });
      },
      async text(name) { const b = await this.blob(name); return b ? b.text() : null; },
    };
  }
  async function makeBackup() {
    const list = live().sort((a, b) => a.takenAt - b.takenAt);
    if (!list.length) { toast('まだ写真がありません'); return; }
    let stop = false;
    const l = openSheet(`<h3>バックアップを作る</h3><p class="hint" data-msg>準備しています…</p><div class="progress"><i></i></div><div data-done hidden></div>`, { onClose: () => { stop = true; } });
    const sh = l.el, msg = $('[data-msg]', sh), bar = $('.progress i', sh);
    const zip = new ZipWriter(), names = new Set();
    const meta = { app: APP_ID, format: 1, version: VERSION, exportedAt: Date.now(), albums: state.albums, meals: [] };
    try {
      for (let k = 0; k < list.length; k++) {
        if (stop) return;
        const m = list[k], full = await fullBlob(m.id);
        if (!full) continue;
        let name = `写真/${fileName(m)}`;
        if (names.has(name)) name = `写真/${m.id}.jpg`;
        names.add(name);
        const tname = `サムネイル/${m.id}.jpg`;
        await zip.add(name, full, m.takenAt);
        await zip.add(tname, m.thumb, m.takenAt);
        const { thumb, ...rest } = m;
        meta.meals.push({ ...rest, file: name, thumbFile: tname });
        msg.textContent = `作っています… ${k + 1} / ${list.length}`;
        bar.style.width = `${((k + 1) / list.length) * 100}%`;
      }
      await zip.add('data.json', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    } catch {
      msg.textContent = 'バックアップを作れませんでした。スマホの空き容量を確認してください。';
      return;
    }
    if (stop) return;
    // ファイル名は毎回同じ（上書きしやすいように日付は付けない）
    const fname = 'ごはん写真_バックアップ.zip';
    const blob = zip.finish(), file = new File([blob], fname, { type: 'application/zip' });
    const canShare = !!navigator.canShare?.({ files: [file] });
    // 保存先を選ばせて書き込めるブラウザ（Android の Chrome 132 以降など）なら、前回のファイルに上書きできる
    const canPick = typeof window.showSaveFilePicker === 'function';
    let saved = null;
    if (canPick) { try { saved = (await db.get('kv', 'backupHandle'))?.handle || null; } catch { saved = null; } }
    msg.textContent = `できました（写真 ${meta.meals.length}枚・${fmtSize(blob.size)}）`;
    $('.progress', sh).hidden = true;
    const done = $('[data-done]', sh);
    done.hidden = false;
    done.innerHTML = canPick
      ? (saved
        ? `<button class="btn primary block" data-y="over">前回のファイルに上書き保存</button>
           <p class="hint center">上書きする先：${esc(saved.name)}</p>
           <button class="btn block" data-y="pick">別の場所に保存</button>`
        : `<p class="hint">保存する場所を選んでください（例：「ダウンロード」や Google ドライブ）。次からは、同じファイルに上書きできます。</p>
           <button class="btn primary block" data-y="pick">保存先を選んで保存</button>`)
        + '<p class="hint">このファイルを Google ドライブやパソコンにも置いておくと、スマホをなくしたときも安心です。</p>'
      : canShare
        // iPhone など：「共有して保存」だけ（「スマホに保存」は出さない。2026-09-23 ユーザー指示）
        ? `<p class="hint">「共有して保存」→「ファイルに保存」で、前回と同じ場所を選んでください。同じ名前のファイルを置き換えられます（iPhone のバージョンによっては別のファイルになるので、そのときは古いほうを消してください）。</p>
           <button class="btn primary block" data-y="share">共有して保存</button>`
        // 保存先も選べず共有もできないブラウザだけ、保存できなくならないよう「スマホに保存」を残す
        : `<p class="hint">「ダウンロード」に保存します。</p>
           <button class="btn primary block" data-y="save">スマホに保存</button>`;
    const finished = text => {
      S.lastBackup = Date.now();
      saveS();
      dirty.add('photos');
      if (text) toast(text, 4500);
    };
    async function writeTo(handle) {
      const opt = { mode: 'readwrite' };
      if ((await handle.queryPermission?.(opt)) !== 'granted' && (await handle.requestPermission?.(opt)) !== 'granted') throw new Error('permission');
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
    }
    done.addEventListener('click', async e => {
      const b = e.target.closest('[data-y]');
      if (!b || b.disabled) return;
      const y = b.dataset.y;
      try {
        if (y === 'over') {
          b.disabled = true;
          await writeTo(saved);
          finished(`「${saved.name}」に上書きしました`);
        } else if (y === 'pick') {
          const h = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'ごはん写真のバックアップ', accept: { 'application/zip': ['.zip'] } }] });
          b.disabled = true;
          await writeTo(h);
          await db.put('kv', { id: 'backupHandle', handle: h });
          finished(`「${h.name}」に保存しました。次からは上書きできます`);
        } else if (y === 'save') {
          download(blob, fname);
          finished('保存しました（「ダウンロード」の中にあります）');
        } else if (y === 'share') {
          finished();
          shareFiles([file]);
        }
      } catch (err) {
        b.disabled = false;
        if (err?.name === 'AbortError') return; // 保存先を選ぶのをやめた
        toast(y === 'over' ? '前回のファイルに書き込めませんでした（消したり移したりした場合など）。「別の場所に保存」を押してください' : '保存できませんでした', 6000);
      }
    });
  }
  async function restoreFrom(file) {
    let z, meta;
    try {
      z = await readZip(file);
      meta = JSON.parse(await z.text('data.json'));
      if (meta?.app !== APP_ID || !Array.isArray(meta.meals)) throw new Error('format');
    } catch {
      await ask({ title: '読み込めませんでした', msg: 'このアプリで作ったバックアップ（.zip）を、そのまま選んでください。', cancel: '', ok: 'OK' });
      return;
    }
    const have = new Set(state.meals.map(m => m.id));
    const todo = meta.meals.filter(m => !have.has(m.id));
    if (!todo.length) { toast('このバックアップの写真は、すべて入っています'); return; }
    const ok0 = await ask({
      title: 'バックアップから戻しますか？',
      msg: `${md(meta.exportedAt, true)} に作ったバックアップです。\n写真 ${meta.meals.length}枚のうち ${todo.length}枚を追加します。\n今ある写真は消えません。`,
      ok: '戻す',
    });
    if (!ok0) return;
    for (const a of meta.albums || []) if (!state.albums.some(x => x.id === a.id)) { await db.put('albums', a); state.albums.push(a); }
    const t = toast(`戻しています… 0/${todo.length}`, 0);
    let ok = 0;
    for (const m of todo) {
      try {
        const full = await z.blob(m.file, 'image/jpeg');
        if (!full) continue;
        const thumb = (m.thumbFile && await z.blob(m.thumbFile, 'image/jpeg')) || (await makeImages(full)).thumb;
        const { file: f, thumbFile, ...rest } = m;
        await saveNew({ meal: Object.assign(blankMeal(), rest, { thumb, deletedAt: 0 }), full });
        ok++;
      } catch { /* 壊れた1枚は飛ばす */ }
      t.update(`戻しています… ${ok}/${todo.length}`);
    }
    refresh();
    toast(`${ok}枚を戻しました`, 4000);
    requestPersist();
  }

  /* ---------- メニュー・設定・使い方 ---------- */
  function openMenu() {
    const items = [['fav', 'heart', 'お気に入り'], ['search', 'search', '検索'], ['trash', 'trash', 'ごみ箱'], ['settings', 'settings', '設定'],
      ['backup', 'backup', 'バックアップ'], ['restore', 'restore', '復元'], ['help', 'help', '使い方']];
    const l = openSheet(`<div class="mgrid">${items.map(([a, ic, t]) => `<button class="mitem" data-x="${a}"><span class="mi">${icon(ic)}</span>${t}</button>`).join('')}</div>`, { cls: 'menu-pop' });
    l.el.addEventListener('click', e => {
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (!x) return;
      if (x === 'restore') { $('#file-restore').click(); back(); return; }
      const go = { fav: () => openAlbum('fav'), search: openSearch, trash: openTrash, settings: openSettings, backup: makeBackup, help: openHelp }[x];
      back(go);
    });
  }
  function openSettings() {
    const seg = (key, opts) => `<div class="seg" data-s="${key}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(S[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const el = h(`<div class="screen">
      <div class="sbar"><button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button><h2>設定</h2></div>
      <div class="set-cap">記録</div>
      <div class="set-group">
        <div class="set-row col"><span class="st">保存する写真の大きさ<small>高画質は容量を多く使います（これから追加する写真に効きます）</small></span>${seg('quality', [['std', '標準'], ['high', '高画質']])}</div>
      </div>
      <div class="set-cap">表示</div>
      <div class="set-group">
        <div class="set-row col"><span class="st">文字の大きさ</span>${seg('font', [['m', '標準'], ['l', '大きい'], ['xl', '特大']])}</div>
        <div class="set-row col"><span class="st">一覧の1行に並べる枚数<small>一覧を2本指でつまんでも変えられます</small></span>${seg('cols', [[2, '2'], [3, '3'], [4, '4'], [5, '5']])}</div>
      </div>
      <div class="set-cap">データ</div>
      <div class="set-group">
        <div class="set-row"><span class="st">保存している写真<small data-usage>計算しています…</small></span></div>
        <div class="set-row"><span class="st">最後のバックアップ<small>${S.lastBackup ? md(S.lastBackup, true) : 'まだありません'}</small></span><button class="btn sm" data-x="backup">作る</button></div>
        <div class="set-row"><span class="st">データの保護<small data-persist>確認しています…</small></span></div>
        <div class="set-row" data-install hidden><span class="st">ホーム画面に追加<small>アプリとして開けるようになります</small></span><button class="btn sm primary" data-x="install">追加</button></div>
      </div>
      <div class="set-cap">このアプリについて</div>
      <div class="set-group"><div class="set-row"><span class="st">ごはん写真<small>バージョン ${VERSION}<br>写真はこのスマホの中だけに保存され、外には送られません。<br>「話して入力」を使ったときだけ、声がスマホの音声認識（Google / Apple）に送られて文字になります。<br>写真の文字の読み取りは Tesseract.js（Apache License 2.0）を使い、スマホの中だけで行います。</small></span></div></div>
    </div>`);
    el.addEventListener('click', e => {
      const b = e.target.closest('.seg button');
      if (b) {
        const key = b.parentElement.dataset.s;
        S[key] = key === 'cols' ? +b.dataset.v : b.dataset.v;
        if (key === 'font') S.fontChosen = true;
        saveS(); applyCols(); applyFont();
        $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
        return;
      }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'backup') makeBackup();
      if (x === 'install') installApp();
    });
    (async () => {
      const L = live(), trash = state.meals.length - L.length;
      let text = `${L.length}枚${trash ? `（ごみ箱 ${trash}枚）` : ''}`;
      try { const est = await navigator.storage?.estimate?.(); if (est?.usage) text += `・約${fmtSize(est.usage)}`; } catch { /* 取れなくてもよい */ }
      $('[data-usage]', el).textContent = text;
      let persisted = false;
      try { persisted = await navigator.storage?.persisted?.(); } catch { /* 同上 */ }
      $('[data-persist]', el).textContent = persisted
        ? '有効：スマホの容量が少なくなっても、写真が勝手に消されることはありません'
        : '未設定：ホーム画面に追加して使うと有効になりやすくなります';
      $('[data-install]', el).hidden = !installEvt;
    })();
    pushScreen(el);
  }
  function openHelp() {
    const el = h(`<div class="screen">
      <div class="sbar"><button class="icon-btn" data-a="back" aria-label="戻る">${icon('back')}</button><h2>使い方</h2></div>
      <div class="doc">
        <h3>写真を追加する</h3>
        <p>右下の大きい「＋」ボタンを押すと、スマホの写真を選ぶ画面が開きます。何枚でもまとめて追加できます。1枚だけ選んだときは、日時やアルバム・メモを付けてから保存できます。</p>
        <h3>メモやアルバムを付ける</h3>
        <p>写真を開いて上にスワイプすると、詳細が出ます。アルバム（ママごはん・パパごはん・お弁当・外食・スイーツ）、お店、メモ、レシピ、タグを付けられます。左右にスワイプすると前後の写真に移ります。</p>
        <p>レシピを書いた食事は、アルバムの「レシピ」にまとまります。詳細や記録の画面の「アルバム」で「ママごはん」「パパごはん」「お弁当」「外食」「スイーツ」を押すと、同じ名前のアルバムに入ります。いくつでも同時に選べて、もう一度押すと外れます。♡を押した写真は「お気に入り」にまとまります。</p>
        <h3>文字の大きさ</h3>
        <p>メニューの「設定」→「文字の大きさ」で、標準・大きい・特大から選べます。</p>
        <h3>写真の文字を読み取る</h3>
        <p>レシピ欄の下の「写真の文字を読み取る」から、料理本やレシピカードを撮ると、文字を読み取ってレシピに入れられます。読み取った文字は、入れる前に確認して直せます。縦書きの本は「縦書き」を選んでください。</p>
        <p>読み取りはスマホの中だけで行い、写真は外に送りません。初めて使うときだけ、読み取り用のデータ（数MB）を読み込みます。印刷された文字向けで、手書きは読み取れないことがあります。</p>
        <h3>話して入力する</h3>
        <p>メモとレシピの欄にある「話して入力」を押して話すと、文字になって書き足されます。ひと区切り話すと止まるので、続けるときはもう一度押します。</p>
        <p>レシピ欄では、聞き間違いを料理のことばの辞書で自動で直します（例：「佐藤」→「砂糖」、「故障」→「こしょう」、「鮭 大さじ1」→「酒 大さじ1」）。分量も「大さじ1」「100g」の形にそろえ、材料ごとに改行します。直したときは画面の下に出るので、違っていたら「元に戻す」を押してください。</p>
        <p>メモ欄では、人の名前などを置き換えないよう、軽めに直します。</p>
        <p>このボタンが使えないときは、キーボードのマイクボタンでも話して入力できます（この場合は自動で直りません）。</p>
        <p>話した声は、スマホの音声認識（Android は Google、iPhone は Apple）で文字に変えられます。写真は送られません。</p>
        <h3>まとめて操作する</h3>
        <p>一覧の写真を長押しすると選択モードになり、お気に入り・アルバムへの追加・共有・削除をまとめてできます。選んだ写真が全部お気に入りのときに「お気に入り」を押すと、まとめて外れます。</p>
        <h3>ホーム画面に追加する</h3>
        <ul>
          <li><b>Android（Chrome）</b>：右上の「︙」→「ホーム画面に追加」または「アプリをインストール」</li>
          <li><b>iPhone（Safari）</b>：下の共有ボタン →「ホーム画面に追加」</li>
        </ul>
        <h3>写真の保存場所とバックアップ</h3>
        <div class="box">写真は<b>このスマホの中だけ</b>に保存され、ネットには送られません。そのかわり、このアプリやブラウザのデータを消すと写真も消えます。<br>メニューの「バックアップ」で、ときどきファイルに書き出しておいてください。機種変更のときは、新しいスマホでこのアプリを開き、メニューの「復元」からそのファイルを選びます。</div>
        <p>Android（Chrome）では、初回に「保存先を選んで保存」で場所を選ぶと、次からは「前回のファイルに上書き保存」で同じファイルを新しくできます（ファイルが増えません）。iPhone では、「共有して保存」→「ファイルに保存」で前回と同じ場所を選んでください。</p>
      </div></div>`);
    pushScreen(el);
  }
  async function installApp() {
    if (!installEvt) { openHelp(); return; }
    installEvt.prompt();
    try { await installEvt.userChoice; } catch { /* 閉じられた */ }
    installEvt = null;
    refresh();
  }

  /* ---------- 画面の更新 ---------- */
  const RENDER = { photos: renderPhotos, albums: renderAlbums, calendar: renderCalendar };
  const dirty = new Set();
  function renderActive() { if (dirty.delete(state.tab)) RENDER[state.tab](); }
  function refresh() {
    Object.keys(RENDER).forEach(k => dirty.add(k));
    renderActive();
    stack.forEach(l => l.refresh?.());
  }
  function setTab(t) {
    if (t === 'menu') { openMenu(); return; }
    if (state.tab === t) $(`#page-${t}`).scrollTo({ top: 0, behavior: 'smooth' });
    state.tab = t;
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${t}`));
    $$('.tabbar [data-tab]').forEach(b => { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    renderActive();
  }

  /* ---------- 起動 ---------- */
  function bind() {
    $$('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
    $('.tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    // 右下の＋ボタンは、押すとすぐスマホの写真を選ぶ画面を開く（何枚でも選べる。カメラで撮る選択肢はなくした）
    const pick = $('#file-pick');
    $('#fab').addEventListener('click', () => pick.click());
    pick.addEventListener('change', () => { const f = [...pick.files]; pick.value = ''; addFiles(f); });
    for (const id of ['#file-ocr-camera', '#file-ocr-pick']) {
      const inp = $(id);
      inp.addEventListener('change', () => { const f = inp.files[0]; inp.value = ''; if (f) runOcr(f); });
    }
    const rinp = $('#file-restore');
    rinp.addEventListener('change', () => { const f = rinp.files[0]; rinp.value = ''; if (f) restoreFrom(f); });

    $('#main').addEventListener('click', e => {
      const album = e.target.closest('[data-album]');
      if (album) { openAlbum(album.dataset.album); return; }
      if (e.target.closest('[data-new]')) { newAlbum(); return; }
      const day = e.target.closest('[data-day]');
      if (day) { openDay(day.dataset.day); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'search') openSearch();
      if (a === 'photos-more') photosMore();
      if (a === 'new-album') newAlbum();
      if (a === 'cal-prev') moveMonth(-1);
      if (a === 'cal-next') moveMonth(1);
      if (a === 'cal-today') { const n = new Date(); state.calMonth = new Date(n.getFullYear(), n.getMonth(), 1); renderCalendar(); }
      if (a === 'install') installApp();
      if (a === 'hide-install') { S.hideInstall = true; saveS(); renderPhotos(); }
      if (a === 'backup') makeBackup();
      if (a === 'snooze') { S.snooze = Date.now() + 7 * DAY; saveS(); renderPhotos(); }
    });
    bindGrid($('#photos-grid'));
    bindPinch($('#page-photos'));
    bindSelection();

    // カレンダーは左右スワイプで月を移動
    let cx = 0, cy = 0;
    const cal = $('#cal-grid');
    cal.addEventListener('touchstart', e => { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }, { passive: true });
    cal.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - cx, dy = e.changedTouches[0].clientY - cy;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) moveMonth(dx < 0 ? 1 : -1);
    });

    $$('.page').forEach(p => {
      new IntersectionObserver(([en]) => p.classList.toggle('collapsed', !en.isIntersecting), { root: p, rootMargin: '-60px 0px 0px 0px' }).observe($('.hero', p));
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !stack.length) return;
      if (typing(e.target)) { e.target.blur(); return; }
      back();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; dirty.add('photos'); renderActive(); });
    addEventListener('appinstalled', () => { installEvt = null; S.hideInstall = true; saveS(); refresh(); });
    addEventListener('unhandledrejection', e => { if (e.reason?.name === 'QuotaExceededError') toast('スマホの空き容量が足りません', 5000); });
  }

  async function init() {
    applyCols();
    applyFont();
    bind();
    history.replaceState(null, '');
    const n = new Date();
    state.calMonth = new Date(n.getFullYear(), n.getMonth(), 1);
    try {
      const [meals, albums] = await Promise.all([db.getAll('meals'), db.getAll('albums')]);
      state.meals = meals.map(m => Object.assign(blankMeal(), m));
      state.albums = albums.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      ask({ title: 'データを開けませんでした', msg: 'プライベートモード（シークレットモード）では使えません。普通の画面で開いてください。', cancel: '', ok: 'OK' });
    }
    sortMeals();
    const limit = Date.now() - TRASH_DAYS * DAY;
    const old = state.meals.filter(m => m.deletedAt && m.deletedAt < limit).map(m => m.id);
    if (old.length) { try { await hardDelete(old); } catch { /* 次回また試す */ } }
    refresh();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
