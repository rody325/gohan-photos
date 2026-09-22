# 写真の文字を読み取る部品（OCR）

レシピ欄の「写真の文字を読み取る」で使う。写真はスマホの中だけで処理し、外には送らない。
スマホは、使ったときに必要なファイルだけを読み込む（初回だけ約6MB）。

| ファイル | 取得元 | ライセンス |
|---|---|---|
| `tesseract.min.js` `worker.min.js` | npm `tesseract.js@7.0.0` の `dist/` | Apache License 2.0（`LICENSE-tesseract.js.md`、`*.LICENSE.txt`） |
| `core/tesseract-core-lstm.wasm.js` `core/tesseract-core-simd-lstm.wasm.js` `core/tesseract-core-relaxedsimd-lstm.wasm.js`（スマホの性能に合わせて1つだけ読み込まれる） | npm `tesseract.js-core@7.0.0`（本体 7.0.0 が必要とする版。npm の latest 表示は 6.1.2 なので注意） | Apache License 2.0（`LICENSE-tesseract.js-core`） |
| `lang/jpn.traineddata.gz`（横書き） `lang/jpn_vert.traineddata.gz`（縦書き） | npm `@tesseract.js-data/jpn@1.0.0` `@tesseract.js-data/jpn_vert@1.0.0` の `4.0.0_best_int/`（元は Tesseract の tessdata_best） | Apache License 2.0（tessdata）／ npm パッケージは MIT |

- 2026-09-22 に cdn.jsdelivr.net から取得し、配布元の SHA-256 と一致することを確認した
- 読み取り方式は LSTM のみ（`oem = 1`）。旧方式（Legacy）用のファイルは入れていない
- 版を上げるときは、同じ取得元から同じ名前で入れ替え、`sw.js` の `CACHE` の番号を上げる
