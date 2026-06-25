import { useEffect, useMemo, useRef, useState } from "react";

const PIPELINE = [
  { id: "detect", label: "Scene", detail: "店頭と料理候補を検出" },
  { id: "translate", label: "Taste", detail: "味覚センサーへ変換" },
  { id: "judge", label: "Fit", detail: "自分との相性を判定" },
  { id: "plan", label: "Action", detail: "次の一手を提示" },
];

const SCENES = [
  {
    id: "wakaze",
    target: "中華そば 和渦 TOKYO",
    menu: "特製醤油そば",
    area: "品川",
    verdict: "GO",
    verdictJa: "合いそう",
    confidence: 78,
    tone: "#38d996",
    accent: "#f8c46b",
    bg: "linear-gradient(135deg, #151d24 0%, #3d5159 45%, #d6b27a 46%, #f1d7a3 58%, #27302a 59%, #101513 100%)",
    recognized: {
      title: "醤油ラーメン / 旨味主導",
      detail: "完成度・初見適性・苦味の低さを優先して照合。",
      tags: ["ramen", "umami-led", "first visit"],
    },
    object: {
      title: "Menu board",
      lines: ["特製醤油そば", "鶏と魚介の旨味", "初見向き"],
    },
    anchors: [
      { x: 24, y: 28, label: "店頭", value: "品川 / 初見OK", tone: "#8ce99a" },
      { x: 61, y: 31, label: "料理", value: "醤油そば", tone: "#f8c46b" },
      { x: 46, y: 58, label: "注意", value: "苦味リスク低", tone: "#63e6be" },
    ],
    sensors: [
      { label: "旨味", value: 86, tone: "#38d996" },
      { label: "完成度", value: 78, tone: "#8ce99a" },
      { label: "苦味リスク", value: 18, tone: "#63e6be" },
      { label: "クセ", value: 34, tone: "#f8c46b" },
    ],
    insights: [
      { label: "Positive sensor", value: "ryohe860の肯定センサー検証向き" },
      { label: "Why", value: "旨味と完成度で刺さる可能性が高い" },
      { label: "Log after visit", value: "完成度・食後満足・苦味の有無を記録" },
    ],
    flight: {
      from: "現在地のカメラ",
      to: "品川・北品川エリア",
      eta: "川崎から約20分圏",
      distance: "約11km",
      earthUrl: "https://earth.google.com/web/search/%E4%B8%AD%E8%8F%AF%E3%81%9D%E3%81%B0+%E5%92%8C%E6%B8%A6+TOKYO",
      waypoints: ["Kawasaki", "Shinagawa", "Kitashinagawa", "Wakaze"],
    },
    action: "実食前予測として登録。軽めにしたい日は麺量少なめで検証。",
  },
  {
    id: "agefuku",
    target: "あげ福",
    menu: "とんかつ定食",
    area: "五反田",
    verdict: "STRONG GO",
    verdictJa: "強く合いそう",
    confidence: 84,
    tone: "#38d996",
    accent: "#ffb86b",
    bg: "linear-gradient(135deg, #251a14 0%, #5b3a26 34%, #c79546 35%, #f3c977 49%, #fff0c8 50%, #352018 100%)",
    recognized: {
      title: "とんかつ / 満足感主導",
      detail: "肉・脂・食後満足の強さをご褒美枠として照合。",
      tags: ["tonkatsu", "rich", "reward meal"],
    },
    object: {
      title: "Plate detected",
      lines: ["厚切りロース", "揚げたて", "満足感強め"],
    },
    anchors: [
      { x: 25, y: 36, label: "主役", value: "肉/脂", tone: "#ffb86b" },
      { x: 58, y: 28, label: "相性", value: "満足感高", tone: "#8ce99a" },
      { x: 48, y: 62, label: "制約", value: "頻度管理", tone: "#ffd43b" },
    ],
    sensors: [
      { label: "満足感", value: 94, tone: "#38d996" },
      { label: "旨味", value: 82, tone: "#8ce99a" },
      { label: "重さ", value: 77, tone: "#ffb86b" },
      { label: "クセ", value: 22, tone: "#63e6be" },
    ],
    insights: [
      { label: "Positive sensor", value: "肉/脂の満足感が好みに近い" },
      { label: "Constraint", value: "日常枠ではなく検証日・ご褒美日向き" },
      { label: "Log after visit", value: "重さと満足感の釣り合いを見る" },
    ],
    flight: {
      from: "現在地のカメラ",
      to: "五反田エリア",
      eta: "川崎から約25分圏",
      distance: "約13km",
      earthUrl: "https://earth.google.com/web/search/%E3%81%82%E3%81%92%E7%A6%8F+%E4%BA%94%E5%8F%8D%E7%94%B0",
      waypoints: ["Kawasaki", "Shinagawa", "Gotanda", "Agefuku"],
    },
    action: "普段使いより、ご褒美日の候補として保存。",
  },
  {
    id: "kyoeido",
    target: "共栄堂",
    menu: "スマトラカレー",
    area: "神保町",
    verdict: "CAUTION",
    verdictJa: "注意",
    confidence: 43,
    tone: "#ff8a5c",
    accent: "#ffd43b",
    bg: "linear-gradient(135deg, #100d0b 0%, #2f241d 35%, #65452f 36%, #966841 48%, #1f1713 49%, #0c0b0a 100%)",
    recognized: {
      title: "スマトラカレー / 苦味リスク",
      detail: "苦味・焦げ・通好みの強さを負アンカーとして照合。",
      tags: ["curry", "bitter risk", "negative anchor"],
    },
    object: {
      title: "Curry context",
      lines: ["黒めのソース", "苦味/焦げ", "通好み"],
    },
    anchors: [
      { x: 26, y: 31, label: "味覚", value: "苦味強", tone: "#ff8a5c" },
      { x: 62, y: 38, label: "焦げ", value: "高リスク", tone: "#ffd43b" },
      { x: 43, y: 64, label: "用途", value: "負アンカー", tone: "#ff8787" },
    ],
    sensors: [
      { label: "苦味リスク", value: 92, tone: "#ff8a5c" },
      { label: "焦げ感", value: 88, tone: "#ff8787" },
      { label: "クセ", value: 86, tone: "#ffd43b" },
      { label: "満足感", value: 52, tone: "#f8c46b" },
    ],
    insights: [
      { label: "Negative sensor", value: "ただの食べ盛り/たーさん7331の負センサーと一致" },
      { label: "Why", value: "好きな人には刺さるが、自分には危険" },
      { label: "Use", value: "避ける軸の確認に使う" },
    ],
    flight: {
      from: "現在地のカメラ",
      to: "神保町エリア",
      eta: "川崎から約40分圏",
      distance: "約21km",
      earthUrl: "https://earth.google.com/web/search/%E5%85%B1%E6%A0%84%E5%A0%82+%E7%A5%9E%E4%BF%9D%E7%94%BA",
      waypoints: ["Kawasaki", "Tokyo", "Jimbocho", "Kyoeido"],
    },
    action: "実食候補ではなく、苦味・焦げNG軸の学習データとして扱う。",
  },
];

const UNKNOWN_SCENE = {
  id: "unknown",
  target: "未判定の写真",
  menu: "写真入力",
  area: "Web PoC",
  verdict: "HOLD",
  verdictJa: "判断できない",
  confidence: 12,
  tone: "#adb5bd",
  accent: "#ffd43b",
  bg: "linear-gradient(135deg, #20252b 0%, #535b63 45%, #adb5bd 46%, #dee2e6 56%, #30363d 57%, #16191d 100%)",
  recognized: {
    title: "店名/料理を特定できません",
    detail: "デモ対象外の写真は、根拠なしに味覚判定を出さず保留。",
    tags: ["unknown input", "no match", "honest fallback"],
  },
  object: {
    title: "Unknown frame",
    lines: ["店名なし", "料理候補なし", "追加入力待ち"],
  },
  anchors: [
    { x: 24, y: 33, label: "入力", value: "写真のみ", tone: "#ced4da" },
    { x: 61, y: 35, label: "候補", value: "未特定", tone: "#ffd43b" },
    { x: 44, y: 63, label: "判定", value: "保留", tone: "#ff8787" },
  ],
  sensors: [
    { label: "認識根拠", value: 18, tone: "#ced4da" },
    { label: "味覚根拠", value: 12, tone: "#adb5bd" },
    { label: "要追加入力", value: 88, tone: "#ffd43b" },
    { label: "判定保留", value: 92, tone: "#ff8787" },
  ],
  insights: [
    { label: "Stop condition", value: "対象がデモ店舗/メニューに一致しない" },
    { label: "Reason", value: "料理名・店名が取れていない" },
    { label: "Next", value: "Vision APIで候補抽出を追加する" },
  ],
  flight: null,
  action: "店名・料理名の候補を取ってから味覚センサーへ変換する。",
};

const SCENE_OPTIONS = SCENES;
const SCENE_LOOKUP = [...SCENES, UNKNOWN_SCENE];

export default function XRPreview() {
  const [activeId, setActiveId] = useState("wakaze");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanState, setScanState] = useState("ready");
  const [stepIndex, setStepIndex] = useState(0);
  const [flightMode, setFlightMode] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const active = useMemo(() => SCENE_LOOKUP.find((scene) => scene.id === activeId) ?? SCENES[0], [activeId]);
  const currentStep = PIPELINE[stepIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((index) => (index + 1) % PIPELINE.length);
    }, 2100);
    return () => {
      window.clearInterval(timer);
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setImageUrl("");
      runScan();
    } catch {
      setCameraError("カメラは使えませんでした。デモ背景で表示します。");
      setCameraOn(false);
    }
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera();
    setCameraOn(false);
    setImageUrl(URL.createObjectURL(file));
    setCameraError("");
    setActiveId("unknown");
    runScan();
  };

  const runScan = () => {
    setScanState("scanning");
    setStepIndex(0);
    window.setTimeout(() => setScanState("done"), 900);
  };

  const confidenceLabel = active.confidence >= 80 ? "高" : active.confidence >= 60 ? "中" : "保留";

  return (
    <main style={S.page}>
      <style>{`
        @keyframes tsSweep { 0% { transform: translateY(-22%); opacity: .25; } 50% { opacity: .95; } 100% { transform: translateY(118%); opacity: .2; } }
        @keyframes tsPulse { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes tsFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes tsDraw { from { stroke-dashoffset: 240; } to { stroke-dashoffset: 0; } }
        @keyframes tsFlight { 0% { transform: scale(1.25) translate3d(-7%, 7%, 0) rotateX(54deg); } 100% { transform: scale(1) translate3d(0, 0, 0) rotateX(48deg); } }
        @keyframes tsRoute { from { stroke-dashoffset: 420; } to { stroke-dashoffset: 0; } }
      `}</style>

      <section style={S.stage}>
        <div style={{ ...S.cameraLayer, background: active.bg }}>
          {cameraOn && <video ref={videoRef} playsInline muted style={S.video} />}
          {imageUrl && <img src={imageUrl} alt="" style={S.video} />}
          {!cameraOn && !imageUrl && (
            <div style={S.sceneFallback}>
              <div style={{ ...S.storefront, borderColor: active.accent }}>
                <span style={S.storeTopline}>{active.object.title}</span>
                <span style={S.storeSign}>{active.target}</span>
                <span style={S.menuSign}>{active.menu}</span>
                <div style={S.menuLines}>
                  {active.object.lines.map((line) => <span key={line}>{line}</span>)}
                </div>
              </div>
              <div style={S.streetLine} />
            </div>
          )}

          <div style={S.dim} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={S.connectionLayer} aria-hidden="true">
            <path d="M 50 50 C 36 36, 30 31, 24 28" style={{ ...S.connectionPath, stroke: active.tone }} />
            <path d="M 50 50 C 56 34, 60 32, 61 31" style={{ ...S.connectionPath, stroke: active.accent }} />
            <path d="M 50 50 C 44 58, 44 61, 46 64" style={{ ...S.connectionPath, stroke: active.tone }} />
          </svg>

          <div style={{ ...S.scanFrame, borderColor: active.tone }}>
            <span style={S.scanBeam} />
            <span style={S.reticleDot} />
            <span style={S.cornerA} />
            <span style={S.cornerB} />
            <span style={S.cornerC} />
            <span style={S.cornerD} />
          </div>

          {active.anchors.map((anchor) => (
            <div key={`${active.id}-${anchor.label}`} style={{ ...S.anchor, left: `${anchor.x}%`, top: `${anchor.y}%` }}>
              <span style={{ ...S.anchorDot, background: anchor.tone }} />
              <span style={S.anchorText}>
                <b>{anchor.label}</b>
                <em>{anchor.value}</em>
              </span>
            </div>
          ))}

          <div style={S.topHud}>
            <span style={{ ...S.liveDot, background: active.tone, boxShadow: `0 0 18px ${active.tone}` }} />
            <span>Taste Spoon Lens</span>
            <span style={S.area}>{active.area}</span>
          </div>

          <div style={S.pipeline}>
            {PIPELINE.map((step, index) => (
              <div
                key={step.id}
                style={{
                  ...S.pipelineStep,
                  ...(index === stepIndex ? { borderColor: active.tone, color: "#fff", background: "rgba(255,255,255,0.16)" } : null),
                }}
              >
                <b>{step.label}</b>
                <span>{step.detail}</span>
              </div>
            ))}
          </div>

          {flightMode && active.flight && (
            <div style={S.flightOverlay}>
              <div style={S.flightSky}>
                <span style={S.flightHorizon} />
                <span style={S.flightCompass}>Taste Flight / {active.area}</span>
                <span style={S.flightAltitude}>ALT 1.2km to 60m</span>
              </div>
              <div style={S.flightMap}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={S.flightRoute} aria-hidden="true">
                  <path d="M 10 78 C 24 58, 34 55, 45 45 S 66 28, 88 18" style={{ ...S.flightRouteLine, stroke: active.tone }} />
                  <path d="M 10 78 C 24 58, 34 55, 45 45 S 66 28, 88 18" style={S.flightRouteGlow} />
                </svg>
                <span style={{ ...S.flightPin, left: "10%", top: "78%" }}>現在地</span>
                <span style={{ ...S.flightPin, left: "45%", top: "45%" }}>{active.flight.waypoints[1]}</span>
                <span style={{ ...S.flightPin, left: "88%", top: "18%", background: active.tone, color: "#08100c" }}>{active.target}</span>
                <div style={S.flightCard}>
                  <span style={S.flightLabel}>カメラから店まで飛ぶ</span>
                  <b>{active.flight.from} から {active.flight.to}</b>
                  <span>{active.flight.eta} / {active.flight.distance}</span>
                  <div style={S.flightWaypoints}>
                    {active.flight.waypoints.map((point) => <em key={point}>{point}</em>)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <section style={S.overlayCard}>
          <div style={S.cardHead}>
            <div>
              <p style={S.eyebrow}>Web AR Concept</p>
              <h1 style={S.title}>{active.target}</h1>
              <p style={S.menu}>{active.recognized.title}</p>
            </div>
            <div style={S.badgeStack}>
              <span style={S.pocBadge}>PoC</span>
              <div style={{ ...S.verdict, borderColor: active.tone, color: active.tone }}>
                <b>{active.verdict}</b>
                <span>{active.verdictJa}</span>
              </div>
            </div>
          </div>

          <div style={S.recognitionBox}>
            <span style={S.recognitionLabel}>{scanState === "scanning" ? "読み取り中" : currentStep.label}</span>
            <b style={S.recognitionTitle}>
              {scanState === "scanning" ? "カメラ/写真から文脈を抽出中" : active.recognized.detail}
            </b>
            <div style={S.recognitionTags}>
              {active.recognized.tags.map((tag) => <span key={tag} style={S.recognitionTag}>{tag}</span>)}
            </div>
          </div>

          <div style={S.confidenceRow}>
            <span style={S.confidenceLabel}>仮説強度 {confidenceLabel}</span>
            <div style={S.meter}>
              <span style={{ ...S.meterFill, width: `${active.confidence}%`, background: active.tone }} />
            </div>
            <span style={{ ...S.percent, color: active.tone }}>{active.confidence}%</span>
          </div>

          <div style={S.sensorGrid}>
            {active.sensors.map((sensor) => (
              <div key={sensor.label} style={S.sensor}>
                <div style={S.sensorTop}>
                  <span>{sensor.label}</span>
                  <b>{sensor.value}</b>
                </div>
                <div style={S.sensorTrack}>
                  <span style={{ ...S.sensorFill, width: `${sensor.value}%`, background: sensor.tone }} />
                </div>
              </div>
            ))}
          </div>

          <div style={S.insightStack}>
            {active.insights.map((insight) => (
              <div key={insight.label} style={S.insight}>
                <span>{insight.label}</span>
                <b>{insight.value}</b>
              </div>
            ))}
          </div>

          <div style={S.altBox}>
            <span style={S.altLabel}>Next action</span>
            <span>{active.action}</span>
          </div>

          {active.flight && (
            <div style={S.flightActions}>
              <button type="button" style={S.flightButton} onClick={() => setFlightMode((value) => !value)}>
                {flightMode ? "カメラに戻る" : "Taste Flight起動"}
              </button>
              <a href={active.flight.earthUrl} target="_blank" rel="noreferrer" style={S.earthLink}>
                Google Earthで開く
              </a>
            </div>
          )}
        </section>
      </section>

      <section style={S.controls}>
        <div style={S.targetRow}>
          {SCENE_OPTIONS.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => {
                setActiveId(scene.id);
                runScan();
              }}
              aria-pressed={activeId === scene.id}
              style={{ ...S.targetButton, ...(activeId === scene.id ? S.targetButtonOn : null) }}
            >
              <span style={S.demoPrefix}>Demo</span>
              {scene.target}
            </button>
          ))}
        </div>

        <div style={S.actionRow}>
          <button type="button" style={S.primaryButton} onClick={cameraOn ? runScan : startCamera}>
            {cameraOn ? "再スキャン" : "カメラで見る"}
          </button>
          {active.flight && (
            <button type="button" style={S.secondaryButton} onClick={() => setFlightMode((value) => !value)}>
              {flightMode ? "Lens表示" : "店まで飛ぶ"}
            </button>
          )}
          <label style={S.secondaryButton}>
            写真を選ぶ
            <input type="file" accept="image/*" onChange={handleImage} style={S.fileInput} />
          </label>
          <button
            type="button"
            style={S.secondaryButton}
            onClick={() => {
              stopCamera();
              setCameraOn(false);
              setImageUrl("");
              runScan();
            }}
          >
            デモ背景
          </button>
        </div>
        {cameraError && <p style={S.error}>{cameraError}</p>}
      </section>
    </main>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#0b0f0d",
    color: "#f8f3e9",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "16px 12px 26px",
  },
  stage: {
    position: "relative",
    maxWidth: 1120,
    minHeight: 850,
    margin: "0 auto",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.14)",
    background: "#121815",
    boxShadow: "0 32px 90px rgba(0,0,0,0.48)",
  },
  cameraLayer: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  },
  video: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  dim: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle at 42% 36%, rgba(255,255,255,0.08), transparent 28%), linear-gradient(90deg, rgba(0,0,0,0.12), rgba(0,0,0,0.42))",
    pointerEvents: "none",
  },
  sceneFallback: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
  },
  storefront: {
    width: "min(70%, 620px)",
    minHeight: 250,
    display: "grid",
    alignContent: "center",
    gap: 12,
    padding: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    background: "rgba(255, 244, 219, 0.9)",
    color: "#241b13",
    boxShadow: "0 24px 70px rgba(0,0,0,0.44)",
    transform: "perspective(760px) rotateX(2deg) rotateY(-5deg)",
  },
  storeTopline: {
    width: "fit-content",
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(36,27,19,0.09)",
    color: "#5b4a3c",
    fontSize: 12,
    fontWeight: 900,
  },
  storeSign: {
    fontSize: 46,
    fontWeight: 950,
    lineHeight: 1.02,
    letterSpacing: 0,
  },
  menuSign: {
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 6,
    background: "#2f241b",
    color: "#fff6e5",
    fontWeight: 850,
  },
  menuLines: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  streetLine: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: "18%",
    height: 3,
    background: "rgba(255,255,255,0.32)",
  },
  connectionLayer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  connectionPath: {
    fill: "none",
    strokeWidth: 0.3,
    strokeDasharray: 240,
    animation: "tsDraw 1.4s ease both",
    opacity: 0.75,
  },
  scanFrame: {
    position: "absolute",
    left: "30%",
    top: "25%",
    width: "28%",
    height: "30%",
    minWidth: 220,
    minHeight: 170,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: 8,
    boxShadow: "inset 0 0 32px rgba(255,255,255,0.09), 0 0 40px rgba(0,0,0,0.25)",
  },
  scanBeam: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "28%",
    background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))",
    animation: "tsSweep 2.1s ease-in-out infinite",
  },
  reticleDot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 9,
    height: 9,
    marginLeft: -4.5,
    marginTop: -4.5,
    borderRadius: 99,
    background: "#fff",
    boxShadow: "0 0 24px rgba(255,255,255,0.95)",
  },
  cornerA: corner("left", "top"),
  cornerB: corner("right", "top"),
  cornerC: corner("left", "bottom"),
  cornerD: corner("right", "bottom"),
  anchor: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#fff",
    transform: "translate(-50%, -50%)",
    animation: "tsFloat 3.2s ease-in-out infinite",
  },
  anchorDot: {
    width: 14,
    height: 14,
    borderRadius: 99,
    border: "2px solid rgba(255,255,255,0.78)",
    boxShadow: "0 0 26px currentColor",
    animation: "tsPulse 1.8s ease-in-out infinite",
  },
  anchorText: {
    display: "grid",
    gap: 2,
    minWidth: 118,
    padding: "8px 10px",
    borderRadius: 8,
    background: "rgba(8,12,10,0.6)",
    border: "1px solid rgba(255,255,255,0.16)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.32)",
  },
  topHud: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(255,255,255,0.88)",
    textShadow: "0 2px 12px rgba(0,0,0,0.45)",
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
  },
  area: {
    marginLeft: "auto",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },
  pipeline: {
    position: "absolute",
    left: 16,
    bottom: 18,
    display: "grid",
    gap: 8,
    width: "min(310px, calc(100% - 34px))",
  },
  pipelineStep: {
    display: "grid",
    gap: 2,
    padding: "9px 11px",
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.68)",
    backdropFilter: "blur(14px)",
  },
  flightOverlay: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background: "linear-gradient(180deg, rgba(87,154,224,0.92) 0%, rgba(142,196,230,0.76) 36%, rgba(12,18,16,0.42) 37%, rgba(9,12,10,0.82) 100%)",
    backdropFilter: "blur(4px)",
  },
  flightSky: {
    position: "absolute",
    inset: "0 0 auto",
    height: "42%",
    color: "#f8fbff",
    textShadow: "0 2px 12px rgba(0,0,0,0.34)",
  },
  flightHorizon: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: "10%",
    height: 2,
    background: "rgba(255,255,255,0.55)",
    boxShadow: "0 0 26px rgba(255,255,255,0.5)",
  },
  flightCompass: {
    position: "absolute",
    left: "50%",
    top: 24,
    transform: "translateX(-50%)",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.2)",
    fontWeight: 900,
  },
  flightAltitude: {
    position: "absolute",
    right: 18,
    top: 24,
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.2)",
    fontWeight: 850,
  },
  flightMap: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: "-10%",
    height: "68%",
    borderRadius: 8,
    background: "linear-gradient(135deg, rgba(42,92,69,0.95), rgba(31,69,91,0.9) 40%, rgba(137,125,75,0.92) 41%, rgba(55,94,68,0.94) 66%, rgba(25,53,70,0.94))",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 28px 90px rgba(0,0,0,0.45)",
    transformOrigin: "50% 100%",
    animation: "tsFlight 3.4s ease both",
  },
  flightRoute: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  flightRouteLine: {
    fill: "none",
    strokeWidth: 1.1,
    strokeLinecap: "round",
    strokeDasharray: 420,
    animation: "tsRoute 2.2s ease both",
  },
  flightRouteGlow: {
    fill: "none",
    stroke: "rgba(255,255,255,0.38)",
    strokeWidth: 3.2,
    strokeLinecap: "round",
    strokeDasharray: 420,
    animation: "tsRoute 2.2s ease both",
  },
  flightPin: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    padding: "7px 9px",
    borderRadius: 999,
    background: "rgba(8,12,10,0.72)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 12,
    fontWeight: 900,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  },
  flightCard: {
    position: "absolute",
    left: 18,
    bottom: 24,
    display: "grid",
    gap: 7,
    width: "min(360px, calc(100% - 36px))",
    padding: 14,
    borderRadius: 8,
    background: "rgba(255,251,240,0.92)",
    color: "#241b13",
    boxShadow: "0 18px 50px rgba(0,0,0,0.36)",
  },
  flightLabel: {
    color: "#7a6755",
    fontSize: 11,
    fontWeight: 950,
  },
  flightWaypoints: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  overlayCard: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: "min(450px, calc(100% - 36px))",
    padding: 18,
    borderRadius: 8,
    background: "rgba(255, 251, 240, 0.93)",
    color: "#241b13",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 56px rgba(0,0,0,0.38)",
  },
  cardHead: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  eyebrow: {
    margin: "0 0 5px",
    color: "#7a6755",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: 29,
    lineHeight: 1.04,
    letterSpacing: 0,
  },
  menu: {
    margin: "7px 0 0",
    color: "#6b5a4a",
    fontWeight: 760,
  },
  badgeStack: {
    flex: "0 0 auto",
    display: "grid",
    justifyItems: "end",
    gap: 7,
  },
  pocBadge: {
    width: "fit-content",
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(47,36,27,0.08)",
    color: "#6b5a4a",
    fontSize: 11,
    fontWeight: 950,
  },
  verdict: {
    display: "grid",
    gap: 1,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: 8,
    padding: "8px 10px",
    fontWeight: 950,
    fontSize: 16,
    background: "#fff",
    textAlign: "right",
  },
  recognitionBox: {
    display: "grid",
    gap: 7,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    background: "rgba(47,36,27,0.06)",
    border: "1px solid rgba(47,36,27,0.08)",
  },
  recognitionLabel: {
    color: "#8c735f",
    fontSize: 11,
    fontWeight: 950,
  },
  recognitionTitle: {
    fontSize: 15,
    lineHeight: 1.35,
  },
  recognitionTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  recognitionTag: {
    borderRadius: 999,
    padding: "5px 7px",
    background: "#fff",
    border: "1px solid rgba(47,36,27,0.08)",
    color: "#5b4a3c",
    fontSize: 11,
    fontWeight: 850,
  },
  confidenceRow: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: "#6b5a4a",
  },
  meter: {
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
    background: "rgba(43,33,24,0.14)",
  },
  meterFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    transition: "width 360ms ease",
  },
  percent: {
    fontWeight: 950,
  },
  sensorGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 16,
  },
  sensor: {
    padding: 10,
    borderRadius: 8,
    background: "rgba(47,36,27,0.06)",
  },
  sensorTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    fontWeight: 850,
  },
  sensorTrack: {
    height: 6,
    marginTop: 8,
    overflow: "hidden",
    borderRadius: 999,
    background: "rgba(47,36,27,0.13)",
  },
  sensorFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
  },
  insightStack: {
    display: "grid",
    gap: 8,
    marginTop: 14,
  },
  insight: {
    display: "grid",
    gap: 3,
    padding: "9px 10px",
    borderRadius: 8,
    background: "#fff",
    border: "1px solid rgba(47,36,27,0.1)",
  },
  altBox: {
    display: "grid",
    gap: 5,
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    background: "#2f241b",
    color: "#fff7e8",
    fontSize: 13,
    lineHeight: 1.45,
  },
  flightActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },
  flightButton: {
    minHeight: 42,
    border: 0,
    borderRadius: 8,
    background: "#38d996",
    color: "#08100c",
    fontWeight: 950,
    cursor: "pointer",
  },
  earthLink: {
    minHeight: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    background: "#fff",
    color: "#241b13",
    textDecoration: "none",
    fontWeight: 900,
    border: "1px solid rgba(47,36,27,0.1)",
  },
  altLabel: {
    color: "#f0c36b",
    fontSize: 11,
    fontWeight: 950,
  },
  controls: {
    maxWidth: 1120,
    margin: "14px auto 0",
    display: "grid",
    gap: 12,
  },
  targetRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
  },
  targetButton: {
    minHeight: 46,
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 8,
    background: "rgba(255,255,255,0.08)",
    color: "#f8f3e9",
    fontWeight: 850,
    cursor: "pointer",
  },
  demoPrefix: {
    display: "inline-block",
    marginRight: 7,
    padding: "2px 6px",
    borderRadius: 999,
    background: "rgba(240,195,107,0.2)",
    color: "inherit",
    fontSize: 11,
    fontWeight: 950,
  },
  targetButtonOn: {
    background: "#fff3dc",
    color: "#251c15",
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 44,
    border: 0,
    borderRadius: 8,
    background: "#f0c36b",
    color: "#20170f",
    padding: "0 18px",
    fontWeight: 950,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 44,
    display: "inline-grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8,
    background: "rgba(255,255,255,0.08)",
    color: "#fff7e8",
    padding: "0 16px",
    fontWeight: 850,
    cursor: "pointer",
  },
  fileInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: "none",
  },
  error: {
    margin: 0,
    textAlign: "center",
    color: "#ffd8a8",
    fontWeight: 750,
  },
};

function corner(x, y) {
  const style = {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "rgba(255,255,255,0.8)",
  };
  style[x] = 0;
  style[y] = 0;
  style.borderTopWidth = y === "top" ? 3 : 0;
  style.borderBottomWidth = y === "bottom" ? 3 : 0;
  style.borderLeftWidth = x === "left" ? 3 : 0;
  style.borderRightWidth = x === "right" ? 3 : 0;
  style.borderStyle = "solid";
  return style;
}
