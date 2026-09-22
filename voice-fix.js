'use strict';
/* 音声入力の聞き間違いを、料理のことばの辞書（recipe-words.js）で直す
 *   VoiceFix.pick(候補の配列, mode) … 音声認識の候補から一番それらしいものを選んで直す
 *   VoiceFix.fix(文字, mode) ………… 1つの文字列を直す
 *   mode: 'recipe' … レシピ欄（聞き間違いの置き換え・分量の書き方・材料ごとの改行まで行う）
 *         'light' …… メモ欄（読みの変換と分量の書き方だけ。人名などを置き換えないため）
 */
(() => {
  const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const isKana = s => /^[ぁ-ゖァ-ヺー]+$/.test(s);
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* ---------- 辞書を読む ---------- */
  const words = new Set();   // 正しい書き方（見出し語と別表記）
  const reading = new Map(); // ひらがなの読み → 見出し語
  const mis = [];            // [聞き間違い, 見出し語, 分量の前だけか]
  for (const raw of String(window.RECIPE_WORDS || '').split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [left, right = ''] = line.split('／');
    const toks = left.trim().split(/\s+/);
    const head = toks[0];
    words.add(head);
    const addReading = r => { const k = toHira(r); if (k.length >= 2 && !reading.has(k)) reading.set(k, head); };
    if (isKana(head)) addReading(head);
    for (const t of toks.slice(1)) { if (isKana(t)) addReading(t); else words.add(t); }
    for (const t of right.trim().split(/\s+/).filter(Boolean)) {
      const qtyOnly = t.endsWith('*');
      mis.push([qtyOnly ? t.slice(0, -1) : t, head, qtyOnly]);
    }
  }
  mis.sort((a, b) => b[0].length - a[0].length);
  const wordList = [...words].filter(w => w.length >= 2).sort((a, b) => b.length - a.length);
  const kataList = [...reading].filter(([k]) => k.length >= 3).map(([k, head]) => [toKata(k), head]);
  const maxWordLen = wordList.reduce((m, w) => Math.max(m, w.length), 1);

  /* ---------- 分量の書き方 ---------- */
  const KNUM = { '〇': 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const KUNIT = { 十: 10, 百: 100, 千: 1000 };
  function kanjiToNum(s) {
    let total = 0, cur = 0;
    for (const c of s) {
      if (c in KNUM) cur = cur * 10 + KNUM[c];
      else { total += (cur || 1) * KUNIT[c]; cur = 0; }
    }
    return total + cur;
  }
  const COUNTER = '(?:g|グラム|kg|キロ|ml|ミリ|cc|L|リットル|個|本|枚|片|房|束|玉|丁|切れ|尾|匹|パック|袋|缶|cm|センチ|分|秒|合|人前|人分|つ)';
  // すぐあとに分量（液体の量やさじ）が続くか
  const QTY = '(?=\\s*(?:大さじ|小さじ|大匙|小匙|カップ|少々|適量|ひとつまみ|\\d+(?:\\.\\d+)?\\s*(?:ml|cc|mL|ミリ|シーシー)|[\\d一二三四五六七八九十半](?![\\d.]*\\s*(?:g|グラム|kg|キロ|個|本|枚|切|尾|匹|パック|袋|缶|cm|センチ))))';
  const BOUND = '(^|[\\s、。,・/（(「\\n])';

  function normalizeUnits(t) {
    t = t.replace(/大匙|大サジ|おおさじ|オオサジ/g, '大さじ').replace(/小匙|小サジ|こさじ|コサジ/g, '小さじ');
    t = t.replace(/(大さじ|小さじ)\s*(いち|さん|よん|はんぶん)(?![ぁ-ゖ])/g, (m, u, n) => u + ({ いち: '1', さん: '3', よん: '4', はんぶん: '1/2' }[n]));
    t = t.replace(/(大さじ|小さじ|カップ)\s*([〇一二三四五六七八九十]+)(?![〇一二三四五六七八九十百千])/g, (m, u, k) => u + kanjiToNum(k));
    t = t.replace(/(大さじ|小さじ|カップ)\s*(\d+(?:\.\d+)?)\s*杯/g, '$1$2');
    t = t.replace(/(大さじ|小さじ|カップ)\s*(?:半分|半)/g, (m, u) => `${u}1/2`);
    t = t.replace(/(\d+)\s*分の\s*(\d+)/g, '$2/$1');
    t = t.replace(/(\d+)\s*と\s*(?:半分|半)/g, '$1と1/2');
    t = t.replace(new RegExp(`([〇一二三四五六七八九十百千]+)(?=\\s*${COUNTER})`, 'g'), (m, k, off, s) => {
      if (k === '十' && /^分[にながで。]/.test(s.slice(off + 1))) return m; // 「十分に」はそのまま
      return String(kanjiToNum(k));
    });
    t = t.replace(/(\d+)\s*ミリ(?:メートル)?(?=\s*(?:幅|厚|角|程度|くらいの厚))/g, '$1mm');
    t = t.replace(/(\d+(?:\.\d+)?)\s*グラム/g, '$1g')
      .replace(/(\d+(?:\.\d+)?)\s*(?:キログラム|キロ)/g, '$1kg')
      .replace(/(\d+(?:\.\d+)?)\s*(?:ミリリットル|ミリ)/g, '$1ml')
      .replace(/(\d+(?:\.\d+)?)\s*シーシー/g, '$1cc')
      .replace(/(\d+(?:\.\d+)?)\s*リットル/g, '$1L')
      .replace(/(\d+(?:\.\d+)?)\s*(?:センチメートル|センチ)/g, '$1cm')
      .replace(/(\d+)\s*ワット/g, '$1W');
    return t;
  }

  /* ---------- 聞き間違いの置き換え ---------- */
  function applyMis(t, changes) {
    for (const [from, to, qtyOnly] of mis) {
      if (!t.includes(from)) continue;
      const re = new RegExp((from.length === 1 ? BOUND : '()') + escRe(from) + (qtyOnly ? QTY : ''), 'g');
      t = t.replace(re, (m, b) => { changes.push([from, to]); return b + to; });
    }
    return t;
  }

  /* ---------- ひらがな・カタカナの読みを見出し語に ---------- */
  const PARTICLES = new Set(['と', 'の', 'を', 'に', 'で', 'や', 'は', 'が', 'も', 'へ', 'から', 'まで', 'より']);
  // かなの並びを「辞書の語」と「助詞」だけで区切れるときだけ変換する（先頭は辞書の語）
  function segRun(run) {
    const h = toHira(run), n = h.length, best = new Array(n + 1).fill(null);
    best[n] = [];
    for (let i = n - 1; i >= 0; i--) {
      for (let j = n; j > i; j--) {
        if (!best[j]) continue;
        const piece = h.slice(i, j);
        if (reading.has(piece)) { best[i] = [reading.get(piece), ...best[j]]; break; }
        if (i > 0 && PARTICLES.has(piece)) { best[i] = [run.slice(i, j), ...best[j]]; break; }
      }
    }
    return best[0] ? best[0].join('') : null;
  }
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }
  // 少し聞き間違えた語（マヨネース → マヨネーズ など）を一番近い語に
  function fuzzyRun(run) {
    const k = toKata(run);
    if (k.length < 4) return null;
    const lim = k.length >= 7 ? 2 : 1;
    let best = null, bestD = lim + 1, tie = false;
    for (const [kk, head] of kataList) {
      if (Math.abs(kk.length - k.length) > lim) continue;
      const d = lev(k, kk);
      if (d < bestD) { bestD = d; best = head; tie = false; } else if (d === bestD && head !== best) tie = true;
    }
    return best && !tie ? best : null;
  }
  // 辞書の長い語の一部になっているかなは触らない（「もち米」の「もち」など）
  function coveredSpans(t) {
    const spans = [];
    for (const w of wordList) {
      let i = t.indexOf(w);
      while (i >= 0) { spans.push([i, i + w.length]); i = t.indexOf(w, i + 1); }
    }
    return spans;
  }
  function convertKana(t, mode, changes) {
    const spans = coveredSpans(t);
    return t.replace(/[ぁ-ゖー]+|[ァ-ヺー]+/g, (run, a) => {
      const b = a + run.length;
      if (spans.some(([s, e]) => s < b && e > a && !(s >= a && e <= b))) return run;
      const seg = segRun(run);
      if (seg !== null) { if (seg !== run) changes.push([run, seg]); return seg; }
      if (/^[ァ-ヺー]+$/.test(run) || (mode === 'recipe' && run.length >= 4)) {
        const f = fuzzyRun(run);
        if (f && f !== run) { changes.push([run, f]); return f; }
      }
      return run;
    });
  }

  /* ---------- レシピの形に整える ---------- */
  const QEND = '(?:(?:大さじ|小さじ|カップ)\\s*\\d+(?:\\.\\d+)?(?:\\/\\d+)?(?:と\\d+\\/\\d+)?'
    + '|\\d+(?:\\.\\d+)?(?:\\/\\d+)?\\s*(?:g|kg|ml|cc|L|個|本|枚|片|かけ|房|束|玉|丁|切れ|尾|匹|パック|袋|缶|cm|mm|合)'
    + '|少々|適量|適宜|ひとつまみ|ひとかけ|お好みで)';
  function startsWithWord(s) {
    for (let L = Math.min(maxWordLen, s.length); L >= 1; L--) if (words.has(s.slice(0, L))) return true;
    return false;
  }
  function format(t) {
    // 「砂糖大さじ1醤油大さじ2」→ 材料ごとに改行
    t = t.replace(new RegExp(`(${QEND})\\s*(?:と|、|,)?\\s*`, 'g'), (m, q, off, s) => {
      const rest = s.slice(off + m.length);
      return rest && startsWithWord(rest) ? `${q}\n` : m;
    });
    // 「砂糖大さじ1」→「砂糖 大さじ1」、「豚肉200g」→「豚肉 200g」
    t = t.replace(/([^\s\d/.、。をにでがはへとものや])(?=大さじ|小さじ|少々|適量|ひとつまみ|適宜|カップ\d)/g, '$1 ');
    t = t.replace(/([^\s\d/.、。をにでがはへとものや])(?=\d+(?:\.\d+)?(?:\/\d+)?\s*(?:g|kg|ml|cc|L|個|本|枚|片|房|束|玉|丁|切れ|尾|匹|パック|袋|缶)(?![a-zA-Z]))/g, '$1 ');
    return t.replace(/[ \t]+\n/g, '\n');
  }

  /* ---------- 公開する関数 ---------- */
  function fix(text, mode = 'recipe') {
    const changes = [];
    let t = String(text || '').normalize('NFKC').trim();
    if (mode === 'recipe') t = applyMis(t, changes);
    t = normalizeUnits(t);
    if (mode === 'recipe') t = applyMis(t, changes);
    t = convertKana(t, mode, changes);
    if (mode === 'recipe') t = format(t);
    const seen = new Set();
    return { text: t.trim(), changes: changes.filter(([a, b]) => { const k = a + '>' + b; if (seen.has(k)) return false; seen.add(k); return true; }) };
  }
  function score(t) {
    let s = 0;
    for (const w of wordList) if (t.includes(w)) s += 1;
    return s + (t.match(new RegExp(QEND, 'g')) || []).length;
  }
  function pick(alternatives, mode = 'recipe') {
    let best = null;
    alternatives.filter(a => a && a.trim()).forEach((a, i) => {
      const r = fix(a, mode);
      r.raw = a.trim();
      r.score = score(r.text) - i * 0.01;
      if (!best || r.score > best.score) best = r;
    });
    return best;
  }
  window.VoiceFix = { fix, pick, wordCount: words.size };
})();
