import React, { useState, useRef } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from "recharts";
import PanmanAnim from "./PanmanAnim.jsx";

// ─────────────────────────────────────────────────────────────
// Taste Spoon ― 味の特徴を一口で
// 味覚特徴量レビュー × 正直パンマン
// ─────────────────────────────────────────────────────────────

const AXES = [
  { key: "bitter", label: "苦味" },
  { key: "sour", label: "酸味" },
  { key: "roast", label: "ロースト感" },
  { key: "creamy", label: "クリーミーさ" },
  { key: "firstTime", label: "初見適性" },
  { key: "picky", label: "人を選ぶ度" },
];

const SAMPLE =
  "神保町のスマトラカレー共栄堂。深煎りを突き詰めたような強い苦味と焦がし感、酸味はほとんどない。クリームっぽいまろやかさもある。一般的な欧風カレーともスパイスカレーとも違って、初見ではかなり人を選ぶ。店主自身も『ウチのカレーはダメな人はダメ』と言っている。";

// デモ用：共栄堂サンプルの「想定」分解結果
const SAMPLE_TASTE = {
  dish: "スマトラカレー",
  bitter: 4, sour: 0, roast: 5, creamy: 3, firstTime: 1, picky: 5,
  comment: "深煎りを突き詰めた焦がし感が主役。刺さる人にはとことん刺さる、人を選ぶ一杯。",
};

const DEFAULT_PROFILE = {
  bitter: 2,
  sour: 4,
  roast: 2,
  creamy: 4,
  firstTime: 4,
  picky: 2,
};

const PROFILE_AXES = [
  { key: "bitter", label: "苦味の強さ" },
  { key: "sour", label: "酸味の強さ" },
  { key: "roast", label: "ロースト感" },
  { key: "creamy", label: "クリーミーさ" },
  { key: "firstTime", label: "とっつきやすさ" },
  { key: "picky", label: "クセの強さ" },
];

// 簡易ルールベース分解（公開デモ用フォールバック）
function ruleBasedAnalyze(text) {
  const t = text || "";
  const hit = (kws) => kws.some((k) => t.includes(k));
  const clamp = (n) => Math.max(0, Math.min(5, n));
  let bitter = 1, sour = 1, roast = 1, creamy = 1, firstTime = 3, picky = 2;
  if (hit(["苦", "ビター", "深煎り"])) bitter += 3;
  if (hit(["酸", "サワー", "レモン", "ヨーグルト"])) sour += 3;
  if (hit(["酸味はほとんどない", "酸味は少ない", "酸味少なめ"])) sour = 0;
  if (hit(["焦がし", "ロースト", "香ばし", "深煎り"])) roast += 4;
  if (hit(["クリーム", "まろやか", "コク", "バター"])) creamy += 3;
  if (hit(["人を選ぶ", "ダメな人はダメ", "独特", "クセ"])) { picky += 3; firstTime -= 2; }
  if (hit(["初見", "万人受け", "誰でも"])) firstTime += 1;
  return {
    dish: hit(["カレー"]) ? "このカレー" : "この料理",
    bitter: clamp(bitter), sour: clamp(sour), roast: clamp(roast),
    creamy: clamp(creamy), firstTime: clamp(firstTime), picky: clamp(picky),
    comment: hit(["人を選ぶ", "独特", "ダメな人はダメ"])
      ? "刺さる人にはとことん刺さる、人を選ぶ系。期待値を合わせて行こう。"
      : "クセは控えめ、初見でも入りやすそうな味わい。",
  };
}

async function analyzeTaste(reviewText) {
  try {
    const prompt = `あなたは料理の味を「味覚特徴量」に分解する専門家です。以下のレビュー/店の説明文を読み、味を6つの軸でそれぞれ0〜5の整数で評価してください。
軸: bitter(苦味), sour(酸味), roast(ロースト感), creamy(クリーミーさ), firstTime(初見適性 5=誰でも食べやすい), picky(人を選ぶ度 5=非常に人を選ぶ)
さらに dish(料理名や対象を短く) と comment(正直パンマンとしての一言コメント30〜60字、付度なし悪意なし)。
レビュー: """${reviewText}"""
必ず以下のJSON形式のみで返答。前置き・コードフェンス不要:
{"dish":"...","bitter":0,"sour":0,"roast":0,"creamy":0,"firstTime":0,"picky":0,"comment":"..."}`;

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
  const weights = { bitter: 1, sour: 1, roast: 1, creamy: 0.8, firstTime: 1, picky: 1.2 };
  let totalW = 0, penalty = 0;
  for (const k of Object.keys(weights)) {
    const w = weights[k];
    totalW += w;
    const diff = Math.abs((taste[k] ?? 0) - (profile[k] ?? 0)) / 5;
    penalty += w * diff;
  }
  return Math.max(0, Math.min(100, Math.round((1 - penalty / totalW) * 100)));
}

function matchVerdict(score) {
  if (score >= 75) return { label: "ばっちり合うはず", tone: "#2f9e44" };
  if (score >= 55) return { label: "わりと好きかも", tone: "#74b816" };
  if (score >= 40) return { label: "ちょっと冒険", tone: "#f08c00" };
  return { label: "覚悟して行こう", tone: "#e8590c" };
}

// 3段階判定。閾値(55 / 40)は matchVerdict の境界(75 / 55 / 40)の部分集合。
// → matchVerdict の各バンドは必ずどれか 1 つの tier に丸ごと収まるので、
//   特大の3段階判定とサブ表示の matchVerdict ラベルは構造的に矛盾しない。
//     合う    = 「ばっちり合うはず」(>=75) + 「わりと好きかも」(>=55)
//     微妙    = 「ちょっと冒険」(>=40)
//     合わない = 「覚悟して行こう」(<40)
function verdictTier(score) {
  if (score >= 55) return { tier: "合う", state: "good", tone: "#2f9e44" };
  if (score >= 40) return { tier: "微妙", state: "hmm", tone: "#f08c00" };
  return { tier: "合わない", state: "bad", tone: "#e8590c" };
}

export default function TasteSpoon() {
  const [text, setText] = useState(SAMPLE);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [result, setResult] = useState({ taste: SAMPLE_TASTE, match: calcMatch(SAMPLE_TASTE, DEFAULT_PROFILE) });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [runSeq, setRunSeq] = useState(0);
  const resultRef = useRef(null);

  const run = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setErr("");
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
  const verdict = result ? matchVerdict(result.match) : null;
  const tier = result ? verdictTier(result.match) : null;

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
        <label style={S.label}>レビュー / 店の説明</label>
        <textarea
          style={S.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="食べた感想や、店の説明文を貼ってください…"
        />
        <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={run} disabled={loading}>
          {loading ? "正直パンマンが味見中…" : "味を分解する"}
        </button>
        {err && <p style={S.err}>{err}</p>}
      </section>

      <section style={S.card}>
        <label style={S.label}>あなたの味覚プロフィール</label>
        <p style={S.hint}>普段の好みでスライダーを動かしてください(相性判定に使います)</p>
        {PROFILE_AXES.map((a) => (
          <div key={a.key} style={S.sliderRow}>
            <span style={S.sliderLabel}>{a.label}</span>
            <input
              type="range" min={0} max={5} step={1}
              value={profile[a.key]}
              onChange={(e) => setProfile({ ...profile, [a.key]: Number(e.target.value) })}
              style={S.slider}
            />
            <span style={S.sliderVal}>{profile[a.key]}</span>
          </div>
        ))}
      </section>

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

            <div style={S.dishLine}>
              <span style={S.dishName}>{result.taste.dish}</span>
              <span style={S.subVerdict}>（{verdict.label}）</span>
            </div>

            {/* 理由（正直パンマンの一言）を主役の一つとして強調 */}
            <div style={S.reasonBox}>
              <div style={S.reasonHead}>
                <span style={S.reasonFace}>🍞</span>
                <span style={S.panmanName}>正直パンマンの見立て</span>
              </div>
              <p style={S.reasonText}>{result.taste.comment}</p>
            </div>

            {/* スコアは補助 */}
            <div style={S.scoreAux}>
              <span style={S.scoreAuxLabel}>あなたとの相性</span>
              <div style={S.scoreAuxRight}>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: `${result.match}%`, background: tier.tone }} />
                </div>
                <span style={{ ...S.scoreAuxNum, color: tier.tone }}>{result.match}%</span>
              </div>
            </div>
          </div>

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
  btn: { marginTop: 12, width: "100%", padding: "13px 0", border: "none", borderRadius: 12, background: "#c0392b", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".5px" },
  err: { color: "#c0392b", fontSize: 13, marginTop: 8 },
  sliderRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  sliderLabel: { width: 110, fontSize: 13, fontWeight: 600, color: "#6a5236" },
  slider: { flex: 1, accentColor: "#c0392b" },
  sliderVal: { width: 18, textAlign: "right", fontWeight: 700, color: "#c0392b" },
  verdictCard: { border: "3px solid", borderRadius: 18, padding: "20px 18px 18px", background: "#fffefb", marginBottom: 14 },
  tierRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "2px 0 10px" },
  tierImgWrap: { display: "inline-flex", lineHeight: 0 },
  idleWrap: { display: "flex", justifyContent: "center", margin: "2px 0 14px" },
  tierEmoji: { fontSize: 36, lineHeight: 1 },
  tierLabel: { fontFamily: "'Bagel Fat One',sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: "1px", lineHeight: 1 },
  dishLine: { textAlign: "center", marginBottom: 14 },
  dishName: { fontSize: 18, fontWeight: 700, color: "#3d2f1e" },
  subVerdict: { fontSize: 13, color: "#9b7d54", marginLeft: 4 },
  reasonBox: { background: "#fff5e6", border: "1.5px solid #f0d9b5", borderRadius: 14, padding: "12px 14px", marginBottom: 14 },
  reasonHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  reasonFace: { fontSize: 20, lineHeight: 1 },
  reasonText: { margin: 0, fontSize: 16.5, lineHeight: 1.8, fontWeight: 600, color: "#4a3a26" },
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
/* 既定(reduced)は静止。動きは no-preference のときだけ付与 */
@media (prefers-reduced-motion: no-preference) {
  .panman-pop   { animation: panPop .62s cubic-bezier(.22,.9,.3,1.25) both; }
  .panman-tilt  { animation: panTilt 1.6s ease-in-out infinite; will-change: transform; }
  .panman-shake { animation: panShake .5s ease-in-out infinite; will-change: transform; }
  .panman-sway  { animation: panSway 1.2s ease-in-out infinite; will-change: transform; }
}
`;
