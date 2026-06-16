// stores.json の一致チェック。
// 実食店(tasted:true)だけを母数に、calcMatch の判定が panmanVerdict と一致するかを見る。
// 冒険モードの予測(tasted:false)は「正解」ではないので一致率の母数から除外する。
//
// 実行: node verify-stores.mjs  /  npm run verify
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "src/data/stores.json"), "utf8"));
const profile = data.profile.axes;

// ── calcMatch / verdictTier は本体(凍結)のコピー。式は src/TasteSpoon.jsx と一致させること ──
const WEIGHTS = { bitter: 1, sour: 1, roast: 1, creamy: 0.8, firstTime: 1, picky: 1.2, volume: 1.5 };
function calcMatch(taste, prof) {
  let totalW = 0;
  let penalty = 0;
  for (const k of Object.keys(WEIGHTS)) {
    const w = WEIGHTS[k];
    totalW += w;
    penalty += w * (Math.abs((taste[k] ?? 0) - (prof[k] ?? 0)) / 5);
  }
  return Math.max(0, Math.min(100, Math.round((1 - penalty / totalW) * 100)));
}
function verdictTier(score) {
  if (score >= 70) return "合う";
  if (score >= 56) return "微妙";
  return "合わない";
}

const tasted = data.stores.filter((s) => s.tasted !== false); // 予測(tasted:false)は除外
const skipped = data.stores.length - tasted.length;

let hit = 0;
const rows = tasted.map((s) => {
  const score = calcMatch(s.axes, profile);
  const pred = verdictTier(score);
  const ok = pred === s.panmanVerdict;
  if (ok) hit += 1;
  return { name: s.name, score, pred, actual: s.panmanVerdict ?? "(なし)", ok };
});

console.log(`実食店(tasted:true) ${tasted.length}軒で一致チェック（予測 ${skipped}軒は母数から除外）\n`);
for (const r of rows) {
  const mark = r.ok ? "✓" : "✗";
  console.log(`${mark} ${String(r.score).padStart(3)}  calc=${r.pred.padEnd(4)} verdict=${String(r.actual).padEnd(4)}  ${r.name}`);
}
const rate = tasted.length ? Math.round((hit / tasted.length) * 100) : 0;
console.log(`\n一致: ${hit}/${tasted.length} (${rate}%)`);
