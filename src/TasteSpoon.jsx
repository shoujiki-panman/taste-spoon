import React, { useState, useRef, useEffect } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from "recharts";
import PanmanAnim from "./PanmanAnim.jsx";

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

const STORE_KEY = "tasteSpoon.profile.v1";
const LEARN_RATE = 0.2; // 1回の学習で taste へ寄せる割合
const LEARN_THRESHOLD = 3; // この回数まで「学習中」表示

const clamp5 = (n) => Math.max(0, Math.min(5, n));

// localStorage から { profile, learnCount } を復元（壊れていればニュートラル）
function loadStore() {
  const fallback = { profile: { ...NEUTRAL_PROFILE }, learnCount: 0 };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    const profile = {};
    for (const a of AXES) {
      const v = p?.profile?.[a.key];
      profile[a.key] = typeof v === "number" ? clamp5(v) : 2.5;
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
function verdictTier(score) {
  if (score >= 70) return { tier: "合う", state: "good", tone: "#2f9e44" };
  if (score >= 56) return { tier: "微妙", state: "hmm", tone: "#f08c00" };
  return { tier: "合わない", state: "bad", tone: "#e8590c" };
}

// 今日の気分／期待のチップ（任意・複数可）
const INTENTS = [
  { id: "bitterLove", label: "苦い・深煎り好き" },
  { id: "bitterHate", label: "苦い・深煎り苦手" },
  { id: "adventure", label: "冒険したい" },
  { id: "safe", label: "無難にいきたい" },
  { id: "noFail", label: "失敗したくない" },
];
// 同時に成立しないチップ（選ぶと相手を外す）
const INTENT_CONFLICTS = {
  bitterLove: ["bitterHate"],
  bitterHate: ["bitterLove"],
  adventure: ["safe", "noFail"],
  safe: ["adventure"],
  noFail: ["adventure"],
};

// calcMatch の結果(base)に「気分」による後段補正を足す。本体は不変。
// taste の各軸は 0..5。中心 2.5 からの振れで補正量を決める。
function intentAdjustedMatch(baseMatch, taste, intents) {
  if (!intents || intents.size === 0) return baseMatch;
  const pickyDev = (taste?.picky ?? 2.5) - 2.5; // + = 人を選ぶ
  // 苦味・ロースト(深煎り)の合成。+ = 苦い/深煎りが強い店
  const bitterDev = (((taste?.bitter ?? 2.5) + (taste?.roast ?? 2.5)) / 2) - 2.5;
  let delta = 0;
  if (intents.has("adventure")) delta += 4 * pickyDev;
  if (intents.has("safe")) delta -= 4 * Math.max(0, pickyDev);
  if (intents.has("noFail")) delta -= 5 * Math.max(0, pickyDev);
  if (intents.has("bitterLove")) delta += 4 * bitterDev; // 苦い店ほど加点
  if (intents.has("bitterHate")) delta -= 4 * Math.max(0, bitterDev); // 苦い店だけ減点
  return Math.max(0, Math.min(100, Math.round(baseMatch + delta)));
}

// 気分が効いたときの、正直パンマンの“理由”補足（在キャラ・任意の1行）
function intentRemark(taste, intents) {
  if (!intents || intents.size === 0) return null;
  const picky = (taste?.picky ?? 2.5) >= 3.5;
  const bitterAvg = ((taste?.bitter ?? 2.5) + (taste?.roast ?? 2.5)) / 2;
  const bitter = bitterAvg >= 3.5;
  const mild = bitterAvg <= 1.5;
  if (intents.has("adventure") && picky)
    return "冒険したい今日なら、この尖り具合はむしろ楽しめるはず。";
  if ((intents.has("noFail") || intents.has("safe")) && picky)
    return "“失敗したくない”なら、ここは少し攻めすぎかも。覚悟がある日に取っておこう。";
  if (intents.has("bitterLove") && bitter)
    return "深煎り・苦め好きなら、この焦がし感はど真ん中のはず。";
  if (intents.has("bitterHate") && bitter)
    return "苦いのが苦手なら、この深煎りはちょっとキツいかも。正直、別の日がいい。";
  if (intents.has("bitterHate") && mild)
    return "苦いの苦手でも、ここは穏やかめ。安心して大丈夫。";
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

export default function TasteSpoon() {
  const [text, setText] = useState(SAMPLE);
  const [store, setStore] = useState(loadStore);
  const { profile, learnCount } = store;
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
  const resultRef = useRef(null);

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

  const radarData = result ? AXES.map((a) => ({ axis: a.label, value: result.taste[a.key] ?? 0 })) : [];
  // calcMatch の生値(result.match)は保持し、表示は気分補正後の値で行う
  const shownMatch = result ? intentAdjustedMatch(result.match, result.taste, intents) : 0;
  const verdict = result ? matchVerdict(shownMatch) : null;
  const tier = result ? verdictTier(shownMatch) : null;
  const remark = result ? intentRemark(result.taste, intents) : null;

  // 2行見立て（1行目=合う理由 / 2行目=注意点。合わない時は なぜ/でもこういう人には）
  const lines = result ? buildReasonLines(result.taste, profile, tier.state) : { line1: "", line2: "" };
  const typed = useTypewriter(lines.line1, runSeq);
  const bubbleText = loading ? "ふむふむ…正直に味見中" : typed;
  const typing = !loading && typed.length < lines.line1.length;

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

      <section style={S.card}>
        <label style={S.label}>口コミ・メニュー説明を貼り付け</label>
        <textarea
          style={S.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="お店の口コミやメニューの説明を貼ってね（例: 食べログのレビュー、お店の紹介文 など）"
        />

        <div style={S.moodLabel}>今日はどんな気分？<span style={S.moodHint}>（任意・複数OK）</span></div>
        <div style={S.chipWrap}>
          {INTENTS.map((it) => {
            const on = intents.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleIntent(it.id)}
                style={{ ...S.chip, ...(on ? S.chipOn : null) }}
              >
                {on ? "✓ " : ""}{it.label}
              </button>
            );
          })}
        </div>

        <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={run} disabled={loading}>
          {loading ? "正直パンマンが味見中…" : "味を分解する"}
        </button>
        {err && <p style={S.err}>{err}</p>}
      </section>

      <details className="tune" style={S.tuneDetails}>
        <summary style={S.tuneSummary}>⚙️ もっと精度を上げる・詳しく調整（任意）</summary>
        <div style={S.tuneBody}>
          <p style={S.hint}>普段の好みに合わせてスライダーを動かすと、相性がより正確になります（触らなくてもOK）。</p>
          {PROFILE_AXES.map((a) => (
            <div key={a.key} style={S.sliderRow}>
              <span style={S.sliderLabel}>{a.label}</span>
              <input
                type="range" min={0} max={5} step={1}
                value={Math.round(profile[a.key])}
                onChange={(e) => setProfile({ ...profile, [a.key]: Number(e.target.value) })}
                style={S.slider}
              />
              <span style={S.sliderVal}>{profile[a.key].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </details>

      {result && (
        <section style={S.resultCard} ref={resultRef}>
          {/* ── 判定カード（主役: 3段階判定 + 正直パンマンの理由）── */}
          <div style={{ ...S.verdictCard, borderColor: tier.tone }}>
            <div style={S.tierRow}>
              <span
                key={loading ? "loading" : `${tier.state}-${runSeq}`}
                className="panman-pop"
                style={S.tierImgWrap}
              >
                <PanmanAnim
                  state={loading ? "loading" : tier.state}
                  size={112}
                  alt={loading ? "正直パンマンが調査中" : `正直パンマン（${tier.tier}）`}
                />
              </span>
              <span style={{ ...S.tierLabel, color: tier.tone }}>{tier.tier}</span>
            </div>

            {/* 正直パンマンの吹き出し（しっぽで真上のパンマンを指す）*/}
            <div
              key={loading ? "bubble-loading" : `bubble-${tier.state}-${runSeq}`}
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
              {!loading && !typing && lines.line2 && (
                <p style={S.reasonText2}>{lines.line2}</p>
              )}
              {!loading && !typing && remark && (
                <p style={S.reasonRemark}>{remark}</p>
              )}
            </div>

            <div style={S.dishLine}>
              <span style={S.dishName}>{result.taste.dish}</span>
              <span style={S.subVerdict}>（{verdict.label}）</span>
            </div>

            {/* スコアは補助 */}
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

            {learnCount < LEARN_THRESHOLD && (
              <p style={S.learnNote}>※まだ学習中。一般的な“人を選ぶ度”ベースの見立てです。</p>
            )}
          </div>

          {/* 判定後の1タップ学習（任意・押さなくてOK）*/}
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

          {/* 食後フィードバック（タグ・複数選択・localStorage保存）*/}
          {!loading && (
            <div style={S.mealBox}>
              <p style={S.mealTitle}>食べた後は？<span style={S.moodHint}>（タップで記録）</span></p>
              <div style={S.chipWrap}>
                {MEAL_TAGS.map((t) => {
                  const on = dishTags.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(t)}
                      style={{ ...S.chip, ...(on ? S.chipOn : null) }}
                    >
                      {on ? "✓ " : ""}{t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* レーダー（Step 4 で詳細トグルへ降格予定。今は下にそのまま表示）*/}
          <div style={S.chartWrap}>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#d8c9b0" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#5a4a35", fontSize: 13, fontWeight: 600 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#c0392b" fill="#e74c3c" fillOpacity={0.45} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

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
  chartWrap: { margin: "4px -6px 8px" },
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
