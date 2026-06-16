import React, { useState, useRef, useEffect } from "react";
import PanmanAnim from "./PanmanAnim.jsx";
import storesData from "./data/stores.json";

const STORES = storesData.stores;
const SELF_PROFILE = storesData.profile.axes; // 『自分たち』をデフォルト/プリセットに
const SPICE_CAP = { couple: 1, solo: 2 }; // 2人/自分だけ の辛さ上限
// 鉄板モード=実食店(tasted:true) / 冒険モード=未食店(tasted:false・予測)。
const TASTED_STORES = STORES.filter((s) => s.tasted !== false);
const ADVENTURE_STORES = STORES.filter((s) => s.tasted === false);
const areasOf = (list) => ["すべて", ...Array.from(new Set(list.map((s) => s.area)))];
const AREAS_BY_MODE = { iron: areasOf(TASTED_STORES), adventure: areasOf(ADVENTURE_STORES) };

// ─────────────────────────────────────────────────────────────
// Taste Spoon ― 味の特徴を一口で
// 味覚特徴量レビュー × 正直パンマン
// ─────────────────────────────────────────────────────────────

// 吹き出しをタイプ風に表示。reduce 設定時は即時全文。
function useTypewriter(text, trigger) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !text) {
      setN(text.length);
      return undefined;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, trigger]);
  return text.slice(0, n);
}

const AXES = [
  { key: "bitter", label: "苦味" },
  { key: "sour", label: "酸味" },
  { key: "roast", label: "ロースト感" },
  { key: "creamy", label: "クリーミーさ" },
  { key: "firstTime", label: "初見適性" },
  { key: "picky", label: "人を選ぶ度" },
  { key: "volume", label: "満足感" },
];
const AXIS_KEYS = AXES.map((a) => a.key);

// ── 頻度ガード（クールダウン）。calcMatch には一切触れない。来店記録と絞り込みだけ。 ──
// localStorage: visits:<storeId> = 最終来店日(ISO "YYYY-MM-DD")
const visitKey = (id) => `visits:${id}`;
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function daysBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00`);
  const b = new Date(`${toIso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
// クールダウン状態。guarded=cooldownDays あり / blocked=まだ期間内（今日行けない）
function cooldownStatus(store, visits, today) {
  const cd = store.cooldownDays;
  const last = visits[store.id] || null;
  if (!cd) return { guarded: false, last: null, blocked: false };
  if (!last) return { guarded: true, last: null, blocked: false, remaining: 0 };
  const since = daysBetween(last, today);
  const remaining = cd - since;
  return { guarded: true, last, since, remaining, blocked: remaining > 0 };
}
// axes が近い＝似た満足感。Manhattan 距離。
function axisDist(a, b) {
  let d = 0;
  for (const k of AXIS_KEYS) d += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  return d;
}
// 代替店: 合う(tier=合う)・tasted:true・クールダウン中でない・辛さ通過の中から axes が一番近い1軒。
// excludeIds: 既におすすめ表示中などで除外したい店（ダブり防止）。
function pickAlternative(blocked, scored, visits, today, excludeIds = new Set()) {
  let best = null;
  let bestD = Infinity;
  for (const x of scored) {
    if (x.tier !== "合う" || x.over || x.s.id === blocked.id || excludeIds.has(x.s.id)) continue;
    if (x.s.tasted === false || cooldownStatus(x.s, visits, today).blocked) continue;
    const d = axisDist(x.s.axes, blocked.axes);
    if (d < bestD) { bestD = d; best = x; }
  }
  return best;
}

const SAMPLE =
  "神保町のスマトラカレー共栄堂。深煎りを突き詰めたような強い苦味と焦がし感、酸味はほとんどない。クリームっぽいまろやかさもある。一般的な欧風カレーともスパイスカレーとも違って、初見ではかなり人を選ぶ。店主自身も『ウチのカレーはダメな人はダメ』と言っている。";

// デモ用：共栄堂サンプルの「想定」分解結果
const SAMPLE_TASTE = {
  dish: "スマトラカレー",
  bitter: 4, sour: 0, roast: 5, creamy: 3, firstTime: 1, picky: 5, volume: 3,
  comment: "深煎りを突き詰めた焦がし感が主役。刺さる人にはとことん刺さる、人を選ぶ一杯。",
};

// 初回・未学習はニュートラル(中間値)。診断もスライダーも無しで即判定できる。
const NEUTRAL_PROFILE = Object.fromEntries(AXES.map((a) => [a.key, 2.5]));

const STORE_KEY = "tasteSpoon.profile.v2"; // v2: デフォルトを『自分たち』に
const LEARN_RATE = 0.2; // 1回の学習で taste へ寄せる割合
const LEARN_THRESHOLD = 3; // この回数まで「学習中」表示

const clamp5 = (n) => Math.max(0, Math.min(5, n));

// localStorage から { profile, learnCount } を復元（無ければ『自分たち』プリセット）
function loadStore() {
  const fallback = { profile: { ...SELF_PROFILE }, learnCount: 0 };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    const profile = {};
    for (const a of AXES) {
      const v = p?.profile?.[a.key];
      profile[a.key] = typeof v === "number" ? clamp5(v) : (SELF_PROFILE[a.key] ?? 2.5);
    }
    return { profile, learnCount: Number(p?.learnCount) || 0 };
  } catch {
    return fallback;
  }
}

// 各軸を taste へ近づける(dir=+1)／遠ざける(dir=-1)。0〜5 にクランプ。
function learnedProfile(profile, taste, dir) {
  const next = {};
  for (const a of AXES) {
    const t = typeof taste?.[a.key] === "number" ? taste[a.key] : 2.5;
    next[a.key] = clamp5(profile[a.key] + dir * LEARN_RATE * (t - profile[a.key]));
  }
  return next;
}

const PROFILE_AXES = [
  { key: "bitter", label: "苦味の強さ" },
  { key: "sour", label: "酸味の強さ" },
  { key: "roast", label: "ロースト感" },
  { key: "creamy", label: "クリーミーさ" },
  { key: "firstTime", label: "とっつきやすさ" },
  { key: "picky", label: "クセの強さ" },
  { key: "volume", label: "満足感・ボリューム" },
];

// 簡易ルールベース分解（公開デモ用フォールバック）
function ruleBasedAnalyze(text) {
  const t = text || "";
  const hit = (kws) => kws.some((k) => t.includes(k));
  const clamp = (n) => Math.max(0, Math.min(5, n));
  let bitter = 1, sour = 1, roast = 1, creamy = 1, firstTime = 3, picky = 2, volume = 3;
  if (hit(["苦", "ビター", "深煎り"])) bitter += 3;
  if (hit(["酸", "サワー", "レモン", "ヨーグルト"])) sour += 3;
  if (hit(["酸味はほとんどない", "酸味は少ない", "酸味少なめ"])) sour = 0;
  if (hit(["焦がし", "ロースト", "香ばし", "深煎り"])) roast += 4;
  if (hit(["クリーム", "まろやか", "コク", "バター"])) creamy += 3;
  if (hit(["人を選ぶ", "ダメな人はダメ", "独特", "クセ"])) { picky += 3; firstTime -= 2; }
  if (hit(["初見", "万人受け", "誰でも"])) firstTime += 1;
  if (hit(["ボリューム", "がっつり", "ガッツリ", "大盛", "食べ応え", "満腹", "デカ", "満足"])) volume += 2;
  if (hit(["量少なめ", "小ぶり", "あっさり", "繊細", "淡白", "物足り", "少量"])) volume -= 2;
  return {
    dish: hit(["カレー"]) ? "このカレー" : "この料理",
    bitter: clamp(bitter), sour: clamp(sour), roast: clamp(roast),
    creamy: clamp(creamy), firstTime: clamp(firstTime), picky: clamp(picky), volume: clamp(volume),
    comment: hit(["人を選ぶ", "独特", "ダメな人はダメ"])
      ? "刺さる人にはとことん刺さる、人を選ぶ系。期待値を合わせて行こう。"
      : "クセは控えめ、初見でも入りやすそうな味わい。",
  };
}

async function analyzeTaste(reviewText) {
  try {
    const prompt = `あなたは料理の味を「味覚特徴量」に分解する専門家です。以下のレビュー/店の説明文を読み、味を7つの軸でそれぞれ0〜5の整数で評価してください。
軸: bitter(苦味), sour(酸味), roast(ロースト感), creamy(クリーミーさ), firstTime(初見適性 5=誰でも食べやすい), picky(人を選ぶ度 5=非常に人を選ぶ), volume(満足感・ボリューム 5=ガッツリ満腹/0=量少なめ・物足りない)
さらに dish(料理名や対象を短く) と comment(正直パンマンとしての一言コメント30〜60字、付度なし悪意なし)。
レビュー: """${reviewText}"""
必ず以下のJSON形式のみで返答。前置き・コードフェンス不要:
{"dish":"...","bitter":0,"sour":0,"roast":0,"creamy":0,"firstTime":0,"picky":0,"volume":0,"comment":"..."}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("api");
    const data = await res.json();
    const text = data.content.filter((i) => i.type === "text").map((i) => i.text).join("").replace(/```json|```/g, "").trim();
    return JSON.parse(text);
  } catch (e) {
    return ruleBasedAnalyze(reviewText);
  }
}

function calcMatch(taste, profile) {
  const weights = { bitter: 1, sour: 1, roast: 1, creamy: 0.8, firstTime: 1, picky: 1.2, volume: 1.5 };
  let totalW = 0, penalty = 0;
  for (const k of Object.keys(weights)) {
    const w = weights[k];
    totalW += w;
    const diff = Math.abs((taste[k] ?? 0) - (profile[k] ?? 0)) / 5;
    penalty += w * diff;
  }
  return Math.max(0, Math.min(100, Math.round((1 - penalty / totalW) * 100)));
}

// 7軸スケールへ校正(2026-06)。旧6軸の 75/55/40 から 80/70/56 へ。
function matchVerdict(score) {
  if (score >= 80) return { label: "ばっちり合うはず", tone: "#2f9e44" };
  if (score >= 70) return { label: "わりと好きかも", tone: "#74b816" };
  if (score >= 56) return { label: "ちょっと冒険", tone: "#f08c00" };
  return { label: "覚悟して行こう", tone: "#e8590c" };
}

// 3段階判定。閾値(70 / 56)は matchVerdict の境界(80 / 70 / 56)の部分集合。
// → matchVerdict の各バンドは必ずどれか 1 つの tier に丸ごと収まるので、
//   特大の3段階判定とサブ表示の matchVerdict ラベルは構造的に矛盾しない。
//     合う    = 「ばっちり合うはず」(>=80) + 「わりと好きかも」(>=70)
//     微妙    = 「ちょっと冒険」(>=56)
//     合わない = 「覚悟して行こう」(<56)
// tone は表示色のみ（しきい値・文言は不変）。Design.md §3 準拠で 微妙(黄)/合わない(赤) を分離し、
// プロジェクタでも一目で見分けられるようにする。
function verdictTier(score) {
  if (score >= 70) return { tier: "合う", state: "good", tone: "#2f9e44" }; // 緑
  if (score >= 56) return { tier: "微妙", state: "hmm", tone: "#e8a013" }; // 黄（旧 #f08c00）
  return { tier: "合わない", state: "bad", tone: "#d83a2e" }; // 赤（旧 #e8590c）
}

// 今日の気分のチップ（任意・複数可）。"その日で変わる気分" だけに絞る。
// 苦味/深煎りの好みは固定の嗜好なので profile 側に反映済み（気分チップからは除外）。
const INTENTS = [
  { id: "hearty", label: "がっつり" },
  { id: "light", label: "軽め" },
  { id: "adventure", label: "冒険したい" },
  { id: "safe", label: "無難にいきたい" },
];
// 同時に成立しないチップ（選ぶと相手を外す）
const INTENT_CONFLICTS = {
  hearty: ["light"],
  light: ["hearty"],
  adventure: ["safe"],
  safe: ["adventure"],
};

// calcMatch の結果(base)に「気分」による後段補正を足す。本体は不変。
// taste の各軸は 0..5。中心 2.5 からの振れで補正量を決める。
function intentAdjustedMatch(baseMatch, taste, intents) {
  if (!intents || intents.size === 0) return baseMatch;
  const pickyDev = (taste?.picky ?? 2.5) - 2.5; // + = 人を選ぶ
  const volumeDev = (taste?.volume ?? 2.5) - 2.5; // + = がっつり / - = 軽め
  let delta = 0;
  if (intents.has("adventure")) delta += 4 * pickyDev;
  if (intents.has("safe")) delta -= 4 * Math.max(0, pickyDev);
  if (intents.has("hearty")) delta += 4 * Math.max(0, volumeDev); // volume 高めの店を加点
  if (intents.has("light")) delta += 4 * Math.max(0, -volumeDev); // volume 低めの店を許容（加点）
  return Math.max(0, Math.min(100, Math.round(baseMatch + delta)));
}

// 気分が効いたときの、正直パンマンの“理由”補足（在キャラ・任意の1行）
function intentRemark(taste, intents) {
  if (!intents || intents.size === 0) return null;
  const picky = (taste?.picky ?? 2.5) >= 3.5;
  const volume = taste?.volume ?? 2.5;
  const heavy = volume >= 3.5;
  const light = volume <= 1.5;
  if (intents.has("adventure") && picky)
    return "冒険したい今日なら、この尖り具合はむしろ楽しめるはず。";
  if (intents.has("safe") && picky)
    return "“無難に”なら、ここは少し攻めすぎかも。覚悟がある日に取っておこう。";
  if (intents.has("hearty") && heavy)
    return "がっつり気分なら、このボリューム感はど真ん中のはず。";
  if (intents.has("hearty") && light)
    return "がっつり食べたい日には、ここはちょっと軽すぎるかも。";
  if (intents.has("light") && light)
    return "軽めでいきたい今日に、この軽やかさはちょうどいい。";
  if (intents.has("light") && heavy)
    return "軽めの気分だと、ここは重ためかも。お腹を空かせて行こう。";
  return null;
}

// 軸ごとの言い回し（good=刺さる理由 / bad=注意点）。hi=その軸が強い店, lo=弱い店。
const AXIS_PHRASE = {
  bitter: {
    hi: { good: "しっかりした苦味が、好きな人にはたまらないはず。", bad: "ただ苦味は強め。苦手な日はしんどいかも。" },
    lo: { good: "苦味は控えめで、すっと入る優しさ。", bad: "苦味のパンチは弱め。物足りない人もいるかも。" },
  },
  sour: {
    hi: { good: "爽やかな酸味が効いて、後味が軽い。", bad: "酸味が立つので、苦手だと気になるかも。" },
    lo: { good: "酸味は穏やかで、丸い味わい。", bad: "酸味は少なめ。爽やかさ狙いだと違うかも。" },
  },
  roast: {
    hi: { good: "深煎りの香ばしさがガツンと刺さる。", bad: "焦がし感が強め。軽い味が好きだと重いかも。" },
    lo: { good: "浅めで軽やか、後を引かない。", bad: "ロースト感は弱め。香ばしさ狙いだと薄いかも。" },
  },
  creamy: {
    hi: { good: "まろやかなコクが心地いい。", bad: "こってり寄りで、重く感じる人も。" },
    lo: { good: "後味すっきりで重くない。", bad: "コクは控えめ。濃厚さ狙いだと物足りないかも。" },
  },
  firstTime: {
    hi: { good: "クセが少なく、誰でもすっと馴染む。", bad: "優等生すぎて、刺激が欲しい人には地味かも。" },
    lo: { good: "一筋縄じゃない個性が光る。", bad: "初見だと面食らうかも。覚悟はいる。" },
  },
  picky: {
    hi: { good: "人を選ぶ尖りを、むしろ楽しめるタイプ向け。", bad: "クセが強いので、無難狙いにはきついかも。" },
    lo: { good: "万人受けする食べやすさ。", bad: "尖りは控えめ。冒険したい日には優等生すぎるかも。" },
  },
  volume: {
    hi: { good: "ボリューム・満足感たっぷりで、しっかり満たされる。", bad: "量多めなので、軽く済ませたい日には重いかも。" },
    lo: { good: "軽やかで、サッと食べたい時にちょうどいい。", bad: "量・満足感は控えめ。がっつり食べたい人には物足りないかも。" },
  },
};

// 一番「際立ち、かつ好みに近い」軸＝合う理由 / 一番摩擦の大きい軸＝注意点
function reasonAxes(taste, profile) {
  let reason = null, caution = null, bestR = -Infinity, bestC = -Infinity;
  for (const a of AXES) {
    const t = taste[a.key] ?? 2.5;
    const p = profile[a.key] ?? 2.5;
    const rScore = Math.abs(t - 2.5) - Math.abs(t - p);
    const fric = Math.abs(t - p);
    if (rScore > bestR) { bestR = rScore; reason = a.key; }
    if (fric > bestC) { bestC = fric; caution = a.key; }
  }
  if (caution === reason) {
    let second = null, s = -Infinity;
    for (const a of AXES) {
      if (a.key === reason) continue;
      const fr = Math.abs((taste[a.key] ?? 2.5) - (profile[a.key] ?? 2.5));
      if (fr > s) { s = fr; second = a.key; }
    }
    caution = second ?? caution;
  }
  return { reason, caution };
}

const dirOf = (taste, key) => ((taste[key] ?? 2.5) > 2.5 ? "hi" : "lo");

// 正直パンマンの2行見立て（合う理由 / 注意点）。合わない時は「なぜ / でもこういう人には」。
function buildReasonLines(taste, profile, state) {
  if (!taste) return { line1: "", line2: "" };
  const { reason, caution } = reasonAxes(taste, profile);
  const rGood = AXIS_PHRASE[reason]?.[dirOf(taste, reason)]?.good;
  const cBad = AXIS_PHRASE[caution]?.[dirOf(taste, caution)]?.bad;
  if (state === "bad") {
    return {
      line1: cBad ?? "今日のあなたには、ちょっと合わないかも。",
      line2: rGood ? `でも、${rGood}` : "でも、刺さる人にはちゃんと刺さる。",
    };
  }
  return {
    line1: rGood ?? "好みに近いポイントがある。",
    line2: cBad ?? "ただ、人によって好みは分かれるかも。",
  };
}

// 食後フィードバックのタグ（複数選択・店/料理キーで localStorage 保存）
const MEAL_TAGS = ["また行きたい", "思ったより苦い", "クセ強め", "ボリューム◎", "口に合わなかった", "期待通り"];
const TAGS_KEY = "tasteSpoon.mealTags.v1";
function loadTagMap() {
  try {
    return JSON.parse(localStorage.getItem(TAGS_KEY)) || {};
  } catch {
    return {};
  }
}

// localStorage の visits:<storeId> を全店ぶん読み出して { storeId: ISO } にする
function loadVisits() {
  const out = {};
  for (const s of STORES) {
    try {
      const v = localStorage.getItem(visitKey(s.id));
      if (v) out[s.id] = v;
    } catch {
      /* 読めない店は無視 */
    }
  }
  return out;
}

// カード上部の写真。store.image(URL or /stores/<id>.jpg) がある店だけ <img> を出す。
// 空文字/未設定、または読み込み失敗のときは枠・余白・背景ごと一切描画しない（null）。
function CardPhoto({ image, name }) {
  const [failed, setFailed] = useState(false);
  const has = !!(image && image.trim());
  if (!has || failed) return null;
  return (
    <div style={S.photoWrap}>
      <img
        src={image}
        alt={`${name} の写真`}
        style={S.photoImg}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </div>
  );
}

// 店名＋エリアで Google マップ検索を新規タブで開く URL。
function mapSearchUrl(name, area) {
  const query = encodeURIComponent(`${name ?? ""} ${area ?? ""}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// 冒険モード(予測)時の判定ラベル。実食判定(合う/微妙/合わない)とは別の“予測”表現にする。
const PREDICT_LABEL = { good: "合いそう", hmm: "微妙かも", bad: "合わなそう" };

// 来店記録バー。cooldownDays のある店だけに出す。責めない・煽らない、優しい相棒トーン。
function VisitBar({ last, remaining, onVisited, onReset }) {
  if (!last) {
    return (
      <div style={S.visitBar}>
        <button type="button" style={S.visitBtn} onClick={onVisited}>🍽 行った！</button>
      </div>
    );
  }
  const ok = remaining <= 0;
  return (
    <div style={S.visitBar}>
      <div style={S.visitStatus}>
        <span style={S.visitLast}>最終来店 {last}</span>
        {ok
          ? <span style={S.visitOk}>そろそろ行ってOK！</span>
          : <span style={S.visitWait}>あと{remaining}日</span>}
      </div>
      <div style={S.visitBtns}>
        <button type="button" style={S.visitBtn} onClick={onVisited}>🍽 また行った！</button>
        <button type="button" style={S.visitReset} onClick={onReset}>リセット</button>
      </div>
    </div>
  );
}

// 判定カード（写真＋正直パンマン＋2行理由＋スコア）。単発判定とピッカーの両方で再利用。
// overrideLines を渡すと store.panman/caution をそのまま見立てに使う。
// image/area は店データ（ピッカー）時のみ。単発判定では未指定→写真はプレースホルダ・地図リンク無し。
// prediction=true（冒険モード）: 未食店の予測。ラベルを「合いそう/微妙かも」にし“未食・予測”バッジを出す。
// visit: { last, remaining, onVisited, onReset } を渡すと来店記録バーを出す（cooldownDays のある店のみ）。
function VerdictCard({ taste, profile, intents, overrideLines, recommend, tip, image, area, prediction = false, visit = null, loading = false, animKey = "x" }) {
  const base = calcMatch(taste, profile);
  const shownMatch = intentAdjustedMatch(base, taste, intents);
  const verdict = matchVerdict(shownMatch);
  const tier = verdictTier(shownMatch);
  const remark = intentRemark(taste, intents);
  const lines = overrideLines ?? buildReasonLines(taste, profile, tier.state);
  const typed = useTypewriter(lines.line1, animKey);
  const bubbleText = loading ? "ふむふむ…正直に味見中" : typed;
  const typing = !loading && typed.length < lines.line1.length;
  const tierLabel = prediction ? PREDICT_LABEL[tier.state] : tier.tier; // 予測時は断定しない

  return (
    <div style={{ ...S.verdictCard, borderColor: tier.tone }}>
      {prediction && (
        <div style={S.predictBadgeRow}>
          <span style={S.predictBadge}>🔮 未食・予測</span>
        </div>
      )}

      <CardPhoto image={image} name={taste.dish} />

      <div style={S.tierRow}>
        <span key={loading ? "loading" : `${tier.state}-${animKey}`} className="panman-pop" style={S.tierImgWrap}>
          <PanmanAnim
            state={loading ? "loading" : tier.state}
            size={112}
            alt={loading ? "正直パンマンが調査中" : `正直パンマン（${tierLabel}）`}
          />
        </span>
        <span style={{ ...S.tierLabel, color: tier.tone }}>{tierLabel}</span>
      </div>

      <div
        key={loading ? "bubble-loading" : `bubble-${tier.state}-${animKey}`}
        className="panman-bubble-pop"
        style={S.speechBubble}
      >
        <span style={S.bubbleTailOuter} aria-hidden="true" />
        <span style={S.bubbleTailInner} aria-hidden="true" />
        <div style={S.reasonHead}>
          <span style={S.reasonFace}>🍞</span>
          <span style={S.panmanName}>正直パンマンの見立て</span>
        </div>
        <p style={S.reasonText}>
          {bubbleText}
          {typing && <span className="panman-caret" style={S.caret}>▍</span>}
        </p>
        {!loading && !typing && lines.line2 && <p style={S.reasonText2}>{lines.line2}</p>}
        {!loading && !typing && remark && <p style={S.reasonRemark}>{remark}</p>}
      </div>

      {prediction && <p style={S.predictNote}>🔮 まだ食べてないから、パンマンの予想だよ。</p>}

      <div style={S.dishLine}>
        <span style={S.dishName}>{taste.dish}</span>
        <span style={S.subVerdict}>（{verdict.label}）</span>
      </div>

      {area && (
        <div style={S.mapRow}>
          <a
            href={mapSearchUrl(taste.dish, area)}
            target="_blank"
            rel="noopener noreferrer"
            style={S.mapLink}
          >
            📍 地図で開く
          </a>
        </div>
      )}

      <div style={S.scoreWrap}>
        <div style={S.scoreAux}>
          <span style={S.scoreAuxLabel}>あなたとの相性</span>
          <div style={S.scoreAuxRight}>
            <div style={S.barTrack}>
              <div style={{ ...S.barFill, width: `${shownMatch}%`, background: tier.tone }} />
            </div>
            <span style={{ ...S.scoreAuxNum, color: tier.tone }}>{shownMatch}%</span>
          </div>
        </div>
        <p style={S.scoreCaption}>あなたの好みにどれだけ近いか</p>
      </div>

      {(recommend || tip) && (
        <div style={S.metaBox}>
          {recommend && <p style={S.metaLine}><b style={S.metaKey}>おすすめ</b>{recommend}</p>}
          {tip && <p style={S.metaLine}><b style={S.metaKey}>ヒント</b>{tip}</p>}
        </div>
      )}

      {visit && <VisitBar {...visit} />}
    </div>
  );
}

export default function TasteSpoon() {
  const [text, setText] = useState(SAMPLE);
  const [store, setStore] = useState(loadStore);
  const { profile } = store;
  const setProfile = (next) =>
    setStore((s) => ({ ...s, profile: typeof next === "function" ? next(s.profile) : next }));
  const [result, setResult] = useState(() => ({
    taste: SAMPLE_TASTE,
    match: calcMatch(SAMPLE_TASTE, store.profile),
  }));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [runSeq, setRunSeq] = useState(0);
  const [feedback, setFeedback] = useState(null); // null | 'fit' | 'meh' | 'no'
  const [intents, setIntents] = useState(() => new Set()); // 今日の気分（任意・複数）
  const [tagMap, setTagMap] = useState(loadTagMap); // 食後タグ（料理名キー）
  const [picked, setPicked] = useState(false); // ボタン押下後に結果表示
  const [area, setArea] = useState("すべて"); // エリア単選
  const [party, setParty] = useState("couple"); // couple=2人 / solo=自分だけ
  const [mode, setMode] = useState("iron"); // iron=鉄板(実食) / adventure=冒険(予測)
  const [visits, setVisits] = useState(loadVisits); // { storeId: 最終来店日ISO }
  const resultRef = useRef(null);

  // モード切替（エリア候補が変わるので area はリセット）
  const switchMode = (m) => { setMode(m); setArea("すべて"); };
  const areas = AREAS_BY_MODE[mode];

  // 来店記録（localStorage: visits:<storeId>）
  const markVisited = (id) => {
    const t = todayStr();
    try { localStorage.setItem(visitKey(id), t); } catch { /* 保存失敗は無視 */ }
    setVisits((v) => ({ ...v, [id]: t }));
  };
  const resetVisit = (id) => {
    try { localStorage.removeItem(visitKey(id)); } catch { /* 無視 */ }
    setVisits((v) => { const n = { ...v }; delete n[id]; return n; });
  };
  // cooldownDays のある店だけ visit prop を作る（無ければ null＝バー非表示）
  const visitPropFor = (s) => {
    if (!s.cooldownDays) return null;
    const st = cooldownStatus(s, visits, todayStr());
    return { last: st.last, remaining: st.remaining ?? 0, onVisited: () => markVisited(s.id), onReset: () => resetVisit(s.id) };
  };

  const dishKey = result?.taste?.dish ?? "";
  const dishTags = new Set(tagMap[dishKey] ?? []);
  const toggleTag = (tag) => {
    setTagMap((m) => {
      const cur = new Set(m[dishKey] ?? []);
      if (cur.has(tag)) cur.delete(tag);
      else cur.add(tag);
      const next = { ...m, [dishKey]: Array.from(cur) };
      try {
        localStorage.setItem(TAGS_KEY, JSON.stringify(next));
      } catch {
        /* 保存失敗は無視 */
      }
      return next;
    });
  };

  const toggleIntent = (id) => {
    setIntents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        for (const c of INTENT_CONFLICTS[id] ?? []) next.delete(c);
      }
      return next;
    });
  };

  // profile / 学習回数を localStorage に永続化
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* ストレージ不可でも判定は続行 */
    }
  }, [store]);

  // 判定後の1タップ学習（合った→寄せる / 合わなかった→遠ざける / 微妙→据置）
  const giveFeedback = (kind) => {
    setFeedback(kind);
    if (kind === "meh") {
      setStore((s) => ({ ...s, learnCount: s.learnCount + 1 }));
      return;
    }
    const dir = kind === "fit" ? 1 : -1;
    setStore((s) => ({
      profile: learnedProfile(s.profile, result.taste, dir),
      learnCount: s.learnCount + 1,
    }));
  };

  const run = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setErr("");
    setFeedback(null);
    try {
      const taste = await analyzeTaste(text.trim());
      const match = calcMatch(taste, profile);
      setResult({ taste, match });
      setRunSeq((n) => n + 1);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setErr("味の分解に失敗しました。もう一度試してください。");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (result?.taste) setResult((r) => ({ ...r, match: calcMatch(r.taste, profile) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // 鉄板モード: 実食店(tasted:true)からピック（エリア単選＋辛さcap＋気分補正）
  const cap = SPICE_CAP[party];
  const scoreStore = (s) => {
    const shown = intentAdjustedMatch(calcMatch(s.axes, profile), s.axes, intents);
    return { s, shown, tier: verdictTier(shown).tier, over: (s.spice ?? 0) > cap };
  };
  const ironAreaStores = area === "すべて" ? TASTED_STORES : TASTED_STORES.filter((s) => s.area === area);
  const scored = ironAreaStores.map(scoreStore);
  // 代替提案はエリア横断（どのエリア選択でも安定して出す）。全実食店をスコアリング。
  const scoredAll = TASTED_STORES.map(scoreStore);
  const spicy = scored.filter((x) => x.over);
  const safe = scored.filter((x) => !x.over);
  const today = todayStr();
  const fitAll = safe.filter((x) => x.tier === "合う").sort((a, b) => b.shown - a.shown);
  // クールダウン中の合う店は「今日行ける」から外し、代替提案へ回す
  const fitList = fitAll.filter((x) => !cooldownStatus(x.s, visits, today).blocked).slice(0, 3);
  const fitBlocked = fitAll.filter((x) => cooldownStatus(x.s, visits, today).blocked);
  const avoidList = safe.filter((x) => x.tier !== "合う").sort((a, b) => b.shown - a.shown);

  // 冒険モード: 未食店(tasted:false)を calcMatch で予測。スコア降順で全件カード表示。
  const advAreaStores = area === "すべて" ? ADVENTURE_STORES : ADVENTURE_STORES.filter((s) => s.area === area);
  const advList = advAreaStores
    .map((s) => ({ s, shown: intentAdjustedMatch(calcMatch(s.axes, profile), s.axes, intents) }))
    .sort((a, b) => b.shown - a.shown);

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div style={S.spoon}>🥄</div>
        <div>
          <h1 style={S.title}>Taste Spoon</h1>
          <p style={S.subtitle}>味の特徴を、一口で。</p>
        </div>
      </header>

      <p style={S.lede}>
        点数や写真じゃなく、<b>自分の舌に合うか</b>を先に知る。
        レビューや店の説明を入れると、味を6つの特徴量に分解して、
        あなたとの相性を判定します。
      </p>

      <div style={S.idleWrap}>
        <PanmanAnim state="idle" size={96} />
      </div>

      {/* モード切替: 鉄板(実食保証) / 冒険(予測で発見) */}
      <div style={S.modeRow}>
        {[
          ["iron", "🍳 鉄板モード", "実食保証"],
          ["adventure", "🧭 冒険モード", "予測で発見"],
        ].map(([id, main, sub]) => (
          <button key={id} type="button" aria-pressed={mode === id}
            onClick={() => switchMode(id)}
            style={{ ...S.modeBtn, ...(mode === id ? S.modeBtnOn : null) }}>
            <span style={S.modeMain}>{main}</span>
            <span style={{ ...S.modeSub, ...(mode === id ? S.modeSubOn : null) }}>{sub}</span>
          </button>
        ))}
      </div>

      {/* メイン: 今日どこ行く? / 冒険する? */}
      <button style={S.bigBtn} onClick={() => setPicked(true)}>
        {mode === "iron" ? "今日どこ行く？🥄" : "冒険する？🧭"}
      </button>

      {picked && (
        <>
          {/* フィルタ */}
          <section style={S.card}>
            <div style={S.filterLabel}>エリア</div>
            <div style={S.chipWrap}>
              {areas.map((a) => (
                <button key={a} type="button" aria-pressed={area === a}
                  onClick={() => setArea(a)} style={{ ...S.chip, ...(area === a ? S.chipOn : null) }}>
                  {area === a ? "✓ " : ""}{a}
                </button>
              ))}
            </div>

            <div style={S.filterLabel}>今日は</div>
            <div style={S.partyRow}>
              {[["couple", "2人"], ["solo", "自分だけ"]].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={party === id}
                  onClick={() => setParty(id)} style={{ ...S.partyBtn, ...(party === id ? S.partyBtnOn : null) }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={S.filterLabel}>気分 <span style={S.moodHint}>（任意・複数OK）</span></div>
            <div style={S.chipWrap}>
              {INTENTS.map((it) => {
                const on = intents.has(it.id);
                return (
                  <button key={it.id} type="button" aria-pressed={on}
                    onClick={() => toggleIntent(it.id)} style={{ ...S.chip, ...(on ? S.chipOn : null) }}>
                    {on ? "✓ " : ""}{it.label}
                  </button>
                );
              })}
            </div>
          </section>

          {mode === "iron" ? (
          <>
          {/* 合う 上位3 */}
          <h2 style={S.sectionTitle}>🍞 今日のおすすめ</h2>
          {fitList.length === 0 ? (
            <p style={S.emptyNote}>
              {fitBlocked.length > 0
                ? "今日行ける「合う」店はお休み中。下の代わりの提案を見てみて。"
                : "このエリア・条件だと「合う」店は無し。正直、別エリアか条件をゆるめてみて。"}
            </p>
          ) : (
            fitList.map(({ s }) => (
              <VerdictCard key={s.id} taste={{ ...s.axes, dish: s.name }} profile={profile}
                intents={intents} overrideLines={{ line1: s.panman, line2: s.caution }}
                recommend={s.recommend} tip={s.tip} image={s.image} area={s.area}
                visit={visitPropFor(s)} animKey={s.id} />
            ))
          )}

          {/* 頻度ガード: クールダウン中の店は「たまの楽しみに」＋代替提案（代替はエリア横断） */}
          {fitBlocked.length > 0 && (
            <h2 style={{ ...S.sectionTitle, color: "#b06a2c" }}>🕒 今日はお休み中</h2>
          )}
          {fitBlocked.map(({ s }) => {
            const st = cooldownStatus(s, visits, today);
            const shownIds = new Set(fitList.map((x) => x.s.id));
            const alt = pickAlternative(s, scoredAll, visits, today, shownIds);
            return (
              <div key={`cd-${s.id}`} style={S.cooldownGroup}>
                <div style={S.cooldownNote}>
                  <p style={S.cooldownLine}>
                    🍞 <b>{s.name}</b>は前回から{st.since}日、あと<b>{st.remaining}日</b>。まだ早いかも。
                    たまの楽しみに取っておこう。{alt ? "代わりにこっちはどう？" : "今日は別の一皿にしようか。"}
                  </p>
                  <div style={S.cooldownMeta}>
                    <span style={S.visitLast}>最終来店 {st.last}</span>
                    <button type="button" style={S.visitReset} onClick={() => resetVisit(s.id)}>来店日をリセット</button>
                  </div>
                </div>
                {alt && (
                  <VerdictCard taste={{ ...alt.s.axes, dish: alt.s.name }} profile={profile}
                    intents={intents} overrideLines={{ line1: alt.s.panman, line2: alt.s.caution }}
                    recommend={alt.s.recommend} tip={alt.s.tip} image={alt.s.image} area={alt.s.area}
                    visit={visitPropFor(alt.s)} animKey={`alt-${alt.s.id}`} />
                )}
              </div>
            );
          })}

          {/* 別枠: 正直に避けたい店（デフォルト閉じる・コンパクト行リスト） */}
          {avoidList.length > 0 && (
            <details className="tune" style={S.collapseDetails}>
              <summary style={{ ...S.collapseSummary, color: "#b06a2c" }}>
                正直、今日は微妙かも（{avoidList.length}軒）
              </summary>
              <div style={S.collapseBody}>
                <p style={S.sectionSub}>正直パンマンが「微妙／合わない」と思った店。避けたい人向けに正直に。</p>
                <ul style={S.miniList}>
                  {avoidList.map(({ s, tier }) => (
                    <li key={s.id} style={S.miniRow}>
                      <div style={S.miniHead}>
                        <span style={S.miniName}>{s.name}</span>
                        <span style={{ ...S.miniTag, color: tier === "微妙" ? "#b87d0a" : "#c0271c",
                          borderColor: tier === "微妙" ? "#ecc873" : "#eaa79f" }}>{tier}</span>
                      </div>
                      <p style={S.miniNote}>{s.panman}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          {/* 別枠: 辛さ注意（デフォルト閉じる・コンパクト行リスト） */}
          {spicy.length > 0 && (
            <details className="tune" style={S.collapseDetails}>
              <summary style={{ ...S.collapseSummary, color: "#e8590c" }}>
                ⚠ 辛さ注意（{spicy.length}軒・{party === "couple" ? "2人" : "自分"}の上限超え）
              </summary>
              <div style={S.collapseBody}>
                <ul style={S.miniList}>
                  {spicy.map(({ s }) => (
                    <li key={s.id} style={S.miniRow}>
                      <div style={S.miniHead}>
                        <span style={S.miniName}>🌶 {s.name}</span>
                        <span style={{ ...S.miniTag, color: "#e8590c", borderColor: "#f0b49c" }}>辛さ{s.spice}</span>
                      </div>
                      <p style={S.miniNote}>{s.signature}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
          </>
          ) : (
          <>
          {/* 冒険モード: 未食店を予測で発見（calcMatch は鉄板と同じ・断定はしない） */}
          <h2 style={S.sectionTitle}>🧭 冒険モード（予測で発見）</h2>
          <p style={S.sectionSub}>
            まだ実食してない有名店を、正直パンマンが axes から“予測”。保証じゃなく「合いそう／微妙かも」だよ。
          </p>
          {advList.length === 0 ? (
            <p style={S.emptyNote}>このエリアには冒険候補がまだ無い。別エリアか「すべて」で見てみて。</p>
          ) : (
            advList.map(({ s }) => (
              <VerdictCard key={s.id} taste={{ ...s.axes, dish: s.name }} profile={profile}
                intents={intents} overrideLines={{ line1: s.panman, line2: s.caution }}
                recommend={s.recommend} tip={s.tip} image={s.image} area={s.area}
                prediction visit={visitPropFor(s)} animKey={s.id} />
            ))
          )}
          </>
          )}
        </>
      )}

      {/* 裏ツール: お店を登録する（口コミから判定）*/}
      <details className="tune" style={S.tuneDetails}>
        <summary style={S.tuneSummary}>＋ お店を登録する（口コミから判定）</summary>
        <div style={S.tuneBody}>
          <label style={S.label}>口コミ・メニュー説明を貼り付け</label>
          <textarea style={S.textarea} value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder="お店の口コミやメニューの説明を貼ってね（例: 食べログのレビュー、お店の紹介文 など）" />
          <div style={S.moodLabel}>今日はどんな気分？<span style={S.moodHint}>（任意・複数OK）</span></div>
          <div style={S.chipWrap}>
            {INTENTS.map((it) => {
              const on = intents.has(it.id);
              return (
                <button key={it.id} type="button" aria-pressed={on}
                  onClick={() => toggleIntent(it.id)} style={{ ...S.chip, ...(on ? S.chipOn : null) }}>
                  {on ? "✓ " : ""}{it.label}
                </button>
              );
            })}
          </div>
          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={run} disabled={loading}>
            {loading ? "正直パンマンが味見中…" : "味を分解する"}
          </button>
          {err && <p style={S.err}>{err}</p>}

          {result && (
            <section style={{ ...S.resultCard, marginTop: 16 }} ref={resultRef}>
              <VerdictCard taste={result.taste} profile={profile} intents={intents}
                loading={loading} animKey={String(runSeq)} />

              {!loading && (
                <div style={S.feedbackBox}>
                  {feedback ? (
                    <p style={S.feedbackThanks}>🍞 正直パンマンが覚えたよ。次の見立てに反映するね。</p>
                  ) : (
                    <>
                      <p style={S.feedbackQ}>実はどうだった？</p>
                      <div style={S.feedbackRow}>
                        <button style={{ ...S.fbBtn, ...S.fbFit }} onClick={() => giveFeedback("fit")}>合った</button>
                        <button style={{ ...S.fbBtn, ...S.fbMeh }} onClick={() => giveFeedback("meh")}>微妙</button>
                        <button style={{ ...S.fbBtn, ...S.fbNo }} onClick={() => giveFeedback("no")}>合わなかった</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {!loading && (
                <div style={S.mealBox}>
                  <p style={S.mealTitle}>食べた後は？<span style={S.moodHint}>（タップで記録）</span></p>
                  <div style={S.chipWrap}>
                    {MEAL_TAGS.map((t) => {
                      const on = dishTags.has(t);
                      return (
                        <button key={t} type="button" aria-pressed={on}
                          onClick={() => toggleTag(t)} style={{ ...S.chip, ...(on ? S.chipOn : null) }}>
                          {on ? "✓ " : ""}{t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </details>

      {/* 味覚プロフィール詳細調整 */}
      <details className="tune" style={S.tuneDetails}>
        <summary style={S.tuneSummary}>⚙️ 味覚プロフィールを詳しく調整（任意）</summary>
        <div style={S.tuneBody}>
          <p style={S.hint}>普段の好みに合わせてスライダーを動かすと、相性がより正確になります（触らなくてもOK）。</p>
          {PROFILE_AXES.map((a) => (
            <div key={a.key} style={S.sliderRow}>
              <span style={S.sliderLabel}>{a.label}</span>
              <input type="range" min={0} max={5} step={1}
                value={Math.round(profile[a.key])}
                onChange={(e) => setProfile({ ...profile, [a.key]: Number(e.target.value) })}
                style={S.slider} />
              <span style={S.sliderVal}>{profile[a.key].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </details>

      <footer style={S.footer}>
        レビューを見る時代から、<b>相性を試食する時代</b>へ。<br />
        <span style={S.future}>※ 将来構想: 味覚デバイス Taste Spoon × ガイドロボ「スタックちゃん」で、相性を“疑似試食”できる体験へ拡張予定。</span>
      </footer>
    </div>
  );
}

const S = {
  page: { maxWidth: 720, margin: "0 auto", padding: "24px 18px 60px", fontFamily: "'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif", color: "#3d2f1e", background: "#fdf6e7", minHeight: "100vh" },
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 6 },
  spoon: { fontSize: 40, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.15))" },
  title: { fontFamily: "'Bagel Fat One',sans-serif", fontSize: 34, margin: 0, color: "#c0392b", letterSpacing: ".5px", lineHeight: 1 },
  subtitle: { margin: "4px 0 0", fontSize: 14, color: "#9b7d54", fontWeight: 600 },
  lede: { fontSize: 15, lineHeight: 1.8, color: "#5a4a35", margin: "14px 2px 22px" },
  card: { background: "#fffdf7", border: "2px solid #ecdcc0", borderRadius: 18, padding: "18px 18px 20px", marginBottom: 16, boxShadow: "0 4px 16px rgba(160,120,60,.08)" },
  resultCard: { background: "#fffdf7", border: "2px solid #f0c9a0", borderRadius: 18, padding: "20px 18px 24px", marginBottom: 16, boxShadow: "0 6px 22px rgba(192,57,43,.12)" },
  label: { display: "block", fontWeight: 700, fontSize: 14, color: "#7a5c34", marginBottom: 8 },
  hint: { fontSize: 12.5, color: "#a08a6a", margin: "0 0 12px" },
  textarea: { width: "100%", boxSizing: "border-box", border: "1.5px solid #e3d2b4", borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.7, resize: "vertical", fontFamily: "inherit", background: "#fffefb", color: "#3d2f1e" },
  moodLabel: { marginTop: 14, fontSize: 13.5, fontWeight: 700, color: "#7a5c34" },
  moodHint: { fontSize: 12, fontWeight: 600, color: "#a08a6a", marginLeft: 4 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { minHeight: 44, padding: "0 16px", borderRadius: 999, border: "2px solid #e3d2b4", background: "#fffefb", color: "#7a5c34", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  chipOn: { borderColor: "#c0392b", background: "#c0392b", color: "#fff", boxShadow: "0 2px 8px rgba(192,57,43,.22)" },
  btn: { marginTop: 14, width: "100%", padding: "13px 0", border: "none", borderRadius: 12, background: "#c0392b", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".5px" },
  bigBtn: { width: "100%", minHeight: 60, padding: "16px 0", border: "none", borderRadius: 18, background: "#c0392b", color: "#fff", fontSize: 22, fontWeight: 800, cursor: "pointer", fontFamily: "'Bagel Fat One',sans-serif", letterSpacing: ".5px", boxShadow: "0 6px 18px rgba(192,57,43,.28)", marginBottom: 18 },
  modeRow: { display: "flex", gap: 10, marginBottom: 12 },
  modeBtn: { flex: 1, minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, border: "2px solid #e3d2b4", borderRadius: 14, background: "#fffefb", color: "#7a5c34", fontFamily: "inherit", cursor: "pointer" },
  modeBtnOn: { borderColor: "#c0392b", background: "#c0392b", color: "#fff", boxShadow: "0 3px 10px rgba(192,57,43,.22)" },
  modeMain: { fontSize: 15.5, fontWeight: 800 },
  modeSub: { fontSize: 11.5, fontWeight: 700, color: "#a08a6a" },
  modeSubOn: { color: "#ffe6df" },
  predictBadgeRow: { display: "flex", justifyContent: "center", marginBottom: 10 },
  predictBadge: { fontSize: 12, fontWeight: 800, color: "#2f6fc4", background: "#eaf2fc", border: "2px solid #c3dbf5", borderRadius: 999, padding: "4px 12px" },
  predictNote: { margin: "-4px 4px 14px", textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#2f6fc4" },
  visitBar: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed #f0e3cd", display: "flex", flexDirection: "column", gap: 10 },
  visitStatus: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  visitLast: { fontSize: 12.5, color: "#8a6f4a", fontWeight: 700 },
  visitWait: { fontSize: 14, fontWeight: 800, color: "#b06a2c", background: "#fbe6cf", borderRadius: 999, padding: "3px 12px" },
  visitOk: { fontSize: 14, fontWeight: 800, color: "#2f9e44", background: "#e3f3e7", borderRadius: 999, padding: "3px 12px" },
  visitBtns: { display: "flex", gap: 8 },
  visitBtn: { flex: 1, minHeight: 46, border: "2px solid #2f9e44", borderRadius: 12, background: "#fffefb", color: "#2f9e44", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, cursor: "pointer" },
  visitReset: { minHeight: 46, padding: "0 14px", border: "2px solid #e3d2b4", borderRadius: 12, background: "#fffefb", color: "#8a6f4a", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  cooldownGroup: { borderLeft: "4px solid #e0a96b", paddingLeft: 12, marginBottom: 18 },
  cooldownNote: { background: "#fff3e0", border: "2px solid #ecc79a", borderRadius: 14, padding: "13px 15px", margin: "0 0 12px" },
  cooldownLine: { margin: 0, fontSize: 15, lineHeight: 1.8, fontWeight: 700, color: "#7a5236" },
  cooldownMeta: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 10 },
  filterLabel: { fontSize: 13, fontWeight: 700, color: "#7a5c34", margin: "12px 0 8px" },
  partyRow: { display: "flex", gap: 8 },
  partyBtn: { flex: 1, minHeight: 44, border: "2px solid #e3d2b4", borderRadius: 12, background: "#fffefb", color: "#7a5c34", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  partyBtnOn: { borderColor: "#c0392b", background: "#c0392b", color: "#fff" },
  sectionTitle: { fontSize: 17, fontWeight: 800, color: "#c0392b", margin: "22px 2px 6px" },
  sectionSub: { fontSize: 12.5, color: "#a08a6a", margin: "0 2px 10px" },
  emptyNote: { fontSize: 14, color: "#8a6f4a", background: "#fffdf7", border: "2px dashed #ecdcc0", borderRadius: 14, padding: "16px 14px", textAlign: "center" },
  collapseDetails: { background: "#fffdf7", border: "2px solid #ecdcc0", borderRadius: 18, margin: "16px 0", boxShadow: "0 4px 16px rgba(160,120,60,.08)", overflow: "hidden" },
  collapseSummary: { listStyle: "none", cursor: "pointer", padding: "14px 18px", fontWeight: 800, fontSize: 14.5, userSelect: "none" },
  collapseBody: { padding: "0 16px 14px" },
  miniList: { listStyle: "none", margin: 0, padding: 0 },
  miniRow: { padding: "10px 2px", borderTop: "1px solid #f0e3cd" },
  miniHead: { display: "flex", alignItems: "center", gap: 8 },
  miniName: { flex: 1, fontSize: 14.5, fontWeight: 700, color: "#3d2f1e" },
  miniTag: { flexShrink: 0, fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999, border: "2px solid", background: "#fffefb" },
  miniNote: { margin: "4px 0 0", fontSize: 13, lineHeight: 1.65, color: "#8a6f4a" },
  metaBox: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0e3cd" },
  metaLine: { margin: "3px 0", fontSize: 13.5, lineHeight: 1.6, color: "#5a4a35" },
  metaKey: { display: "inline-block", marginRight: 6, color: "#d9822b", fontWeight: 700 },
  err: { color: "#c0392b", fontSize: 13, marginTop: 8 },
  sliderRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  sliderLabel: { width: 110, fontSize: 13, fontWeight: 600, color: "#6a5236" },
  slider: { flex: 1, accentColor: "#c0392b" },
  sliderVal: { width: 30, textAlign: "right", fontWeight: 700, color: "#c0392b" },
  tuneDetails: { background: "#fffdf7", border: "2px solid #ecdcc0", borderRadius: 18, marginBottom: 16, boxShadow: "0 4px 16px rgba(160,120,60,.08)", overflow: "hidden" },
  tuneSummary: { listStyle: "none", cursor: "pointer", padding: "14px 18px", fontWeight: 700, fontSize: 14, color: "#7a5c34", userSelect: "none" },
  tuneBody: { padding: "0 18px 18px" },
  learnNote: { margin: "10px 0 0", fontSize: 12, color: "#a08a6a", textAlign: "center" },
  feedbackBox: { margin: "0 0 14px", textAlign: "center" },
  feedbackQ: { margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "#7a5c34" },
  feedbackThanks: { margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#2f9e44" },
  feedbackRow: { display: "flex", gap: 8 },
  fbBtn: { flex: 1, minHeight: 48, border: "2px solid", borderRadius: 12, background: "#fffefb", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  fbFit: { borderColor: "#2f9e44", color: "#2f9e44" },
  fbMeh: { borderColor: "#f08c00", color: "#d97a00" },
  fbNo: { borderColor: "#e8590c", color: "#e8590c" },
  verdictCard: { border: "3px solid", borderRadius: 18, padding: "20px 18px 18px", background: "#fffefb", marginBottom: 14 },
  photoWrap: { height: 180, marginBottom: 14, borderRadius: 14, overflow: "hidden", background: "#fff5e6", border: "2px solid #f0d9b5", display: "flex", alignItems: "center", justifyContent: "center" },
  photoImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  mapRow: { textAlign: "center", margin: "-4px 0 14px" },
  mapLink: { display: "inline-flex", alignItems: "center", gap: 4, minHeight: 40, padding: "8px 16px", borderRadius: 999, border: "2px solid #e3d2b4", background: "#fffefb", color: "#7a5c34", fontSize: 13.5, fontWeight: 700, textDecoration: "none" },
  tierRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "2px 0 10px" },
  tierImgWrap: { display: "inline-flex", lineHeight: 0 },
  idleWrap: { display: "flex", justifyContent: "center", margin: "2px 0 14px" },
  tierEmoji: { fontSize: 36, lineHeight: 1 },
  tierLabel: { fontFamily: "'Bagel Fat One',sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: "1px", lineHeight: 1 },
  dishLine: { textAlign: "center", marginBottom: 14 },
  dishName: { fontSize: 18, fontWeight: 700, color: "#3d2f1e" },
  subVerdict: { fontSize: 13, color: "#9b7d54", marginLeft: 4 },
  speechBubble: { position: "relative", background: "#fff5e6", border: "2px solid #f0d9b5", borderRadius: 14, padding: "12px 14px", margin: "10px 4px 14px", boxShadow: "0 3px 10px rgba(160,120,60,.10)" },
  bubbleTailOuter: { position: "absolute", top: -12, left: "50%", marginLeft: -11, width: 0, height: 0, borderLeft: "11px solid transparent", borderRight: "11px solid transparent", borderBottom: "12px solid #f0d9b5" },
  bubbleTailInner: { position: "absolute", top: -9, left: "50%", marginLeft: -9, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderBottom: "9px solid #fff5e6" },
  caret: { display: "inline-block", marginLeft: 1, color: "#d9822b", fontWeight: 400 },
  reasonHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  reasonFace: { fontSize: 20, lineHeight: 1 },
  reasonText: { margin: 0, fontSize: 16.5, lineHeight: 1.8, fontWeight: 600, color: "#4a3a26" },
  reasonText2: { margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.75, fontWeight: 600, color: "#8a6f4a" },
  reasonRemark: { margin: "8px 0 0", paddingTop: 8, borderTop: "1px dashed #f0d9b5", fontSize: 14, lineHeight: 1.7, fontWeight: 600, color: "#d9822b" },
  scoreWrap: { margin: "2px 0 0" },
  scoreCaption: { margin: "5px 0 0", fontSize: 11.5, color: "#a08a6a" },
  mealBox: { margin: "2px 0 14px" },
  mealTitle: { margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "#7a5c34" },
  scoreAux: { display: "flex", alignItems: "center", gap: 12 },
  scoreAuxLabel: { fontSize: 12.5, fontWeight: 700, color: "#a08a6a", whiteSpace: "nowrap" },
  scoreAuxRight: { flex: 1, display: "flex", alignItems: "center", gap: 10 },
  scoreAuxNum: { fontSize: 20, fontWeight: 800, fontFamily: "'Bagel Fat One',sans-serif", minWidth: 52, textAlign: "right" },
  dishRow: { marginBottom: 6 },
  dishLabel: { fontSize: 12, fontWeight: 700, color: "#bfa178", letterSpacing: "1px" },
  dish: { margin: "2px 0 8px", fontSize: 22, color: "#3d2f1e" },
  matchBox: { border: "2px solid", borderRadius: 14, padding: "14px 16px", margin: "8px 0 18px", background: "#fffefb" },
  matchHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  matchLabel: { fontSize: 14, fontWeight: 700, color: "#6a5236" },
  matchScore: { fontSize: 30, fontWeight: 800, fontFamily: "'Bagel Fat One',sans-serif" },
  barTrack: { height: 10, background: "#efe4d2", borderRadius: 6, overflow: "hidden", margin: "8px 0 6px" },
  barFill: { height: "100%", borderRadius: 6, transition: "width .6s ease" },
  verdict: { textAlign: "right", fontSize: 14, fontWeight: 700 },
  panman: { display: "flex", gap: 12, alignItems: "flex-start" },
  panmanFace: { fontSize: 34, lineHeight: 1, marginTop: 2 },
  bubble: { flex: 1, background: "#fff5e6", border: "1.5px solid #f0d9b5", borderRadius: "4px 14px 14px 14px", padding: "10px 14px" },
  panmanName: { fontSize: 12, fontWeight: 700, color: "#d9822b" },
  panmanText: { margin: "4px 0 0", fontSize: 14.5, lineHeight: 1.7, color: "#4a3a26" },
  footer: { textAlign: "center", fontSize: 13.5, lineHeight: 1.9, color: "#8a6f4a", marginTop: 26 },
  future: { fontSize: 12, color: "#b09870" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Zen+Maru+Gothic:wght@400;500;700&display=swap');
* { -webkit-tap-highlight-color: transparent; }
body { margin: 0; background: #fdf6e7; }
input[type=range] { height: 22px; }
.tune > summary::-webkit-details-marker { display: none; }
.tune > summary::after { content: "▾"; float: right; color: #bfa178; transition: transform .2s; }
.tune[open] > summary::after { transform: rotate(180deg); }
.tune > summary:hover { background: #fbf3df; }
@keyframes panPop {
  0%   { opacity: 0; transform: translateY(18px) scale(.55); }
  55%  { opacity: 1; transform: translateY(-7px) scale(1.10); }
  72%  { transform: translateY(3px) scale(.96); }
  86%  { transform: translateY(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes panTilt {
  0%, 100% { transform: rotate(-5deg); }
  50%      { transform: rotate(5deg); }
}
@keyframes panShake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  15% { transform: translateX(-3px) rotate(-2.5deg); }
  30% { transform: translateX(3px) rotate(2.5deg); }
  45% { transform: translateX(-2px) rotate(-1.5deg); }
  60% { transform: translateX(2px) rotate(1.5deg); }
  75% { transform: translateX(-1px) rotate(0deg); }
}
@keyframes panSway {
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(3deg); }
}
@keyframes panBubblePop {
  0%   { opacity: 0; transform: scale(.7) translateY(-4px); }
  60%  { opacity: 1; transform: scale(1.04) translateY(0); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes panCaret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
/* 既定(reduced)は静止。動きは no-preference のときだけ付与 */
@media (prefers-reduced-motion: no-preference) {
  .panman-pop   { animation: panPop .62s cubic-bezier(.22,.9,.3,1.25) both; }
  .panman-tilt  { animation: panTilt 1.6s ease-in-out infinite; will-change: transform; }
  .panman-shake { animation: panShake .5s ease-in-out infinite; will-change: transform; }
  .panman-sway  { animation: panSway 1.2s ease-in-out infinite; will-change: transform; }
  .panman-bubble-pop { transform-origin: top center; animation: panBubblePop .4s ease-out both; }
  .panman-caret { animation: panCaret .7s steps(1) infinite; }
}
`;
