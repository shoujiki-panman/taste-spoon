import { useEffect, useMemo, useRef, useState } from "react";

const SCENES = [
  {
    id: "wakaze",
    target: "中華そば 和渦 TOKYO",
    menu: "特製醤油そば",
    area: "品川",
    verdict: "合いそう",
    confidence: 78,
    tone: "#2f9e44",
    summary: "旨味と完成度で刺さる可能性が高い。苦味・焦げリスクは低め。",
    sensors: [
      { label: "旨味", value: 86, tone: "#2f9e44" },
      { label: "満足感", value: 72, tone: "#74b816" },
      { label: "苦味リスク", value: 18, tone: "#12b886" },
      { label: "クセ", value: 34, tone: "#fab005" },
    ],
    reasons: ["ryohe860の肯定センサー検証向き", "初見でも入りやすい", "食後ログで完成度を確認"],
    alternative: "軽めにしたい日は、麺量少なめで検証",
    bg: "linear-gradient(135deg, #1b2735 0%, #45545f 46%, #d6b27a 47%, #f1d7a3 58%, #27302a 59%, #151817 100%)",
  },
  {
    id: "agefuku",
    target: "あげ福",
    menu: "とんかつ定食",
    area: "五反田",
    verdict: "強く合いそう",
    confidence: 84,
    tone: "#2f9e44",
    summary: "肉・脂・満足感はかなり強い。ご褒美枠として相性が良さそう。",
    sensors: [
      { label: "満足感", value: 94, tone: "#2f9e44" },
      { label: "旨味", value: 82, tone: "#2f9e44" },
      { label: "重さ", value: 77, tone: "#f08c00" },
      { label: "クセ", value: 22, tone: "#74b816" },
    ],
    reasons: ["肉/脂の満足感が好みに近い", "初見適性が高い", "ダイエット中は頻度管理が必要"],
    alternative: "普段使いより、検証日・ご褒美日に回す",
    bg: "linear-gradient(135deg, #2d2118 0%, #5b3a26 34%, #c79546 35%, #f3c977 49%, #fff0c8 50%, #442919 100%)",
  },
  {
    id: "kyoeido",
    target: "共栄堂",
    menu: "スマトラカレー",
    area: "神保町",
    verdict: "注意",
    confidence: 43,
    tone: "#e8590c",
    summary: "苦味・焦げ・通好みリスクが高い。負アンカーとして記録価値は大きい。",
    sensors: [
      { label: "苦味リスク", value: 92, tone: "#e8590c" },
      { label: "焦げ感", value: 88, tone: "#e8590c" },
      { label: "クセ", value: 86, tone: "#f08c00" },
      { label: "満足感", value: 52, tone: "#fab005" },
    ],
    reasons: ["ただの食べ盛り/たーさん7331の負センサーと一致", "苦味と焦げが前面に出そう", "好きな人には刺さるが自分には危険"],
    alternative: "苦味検証ではなく、避ける軸の確認に使う",
    bg: "linear-gradient(135deg, #120f0d 0%, #2f241d 35%, #65452f 36%, #966841 48%, #1f1713 49%, #0c0b0a 100%)",
  },
];

export default function XRPreview() {
  const [activeId, setActiveId] = useState("wakaze");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanState, setScanState] = useState("ready");
  const [imageUrl, setImageUrl] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const active = useMemo(() => SCENES.find((s) => s.id === activeId) ?? SCENES[0], [activeId]);

  useEffect(() => {
    return () => stopCamera();
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
    runScan();
  };

  const runScan = () => {
    setScanState("scanning");
    window.setTimeout(() => setScanState("done"), 900);
  };

  const confidenceLabel = active.confidence >= 80 ? "高" : active.confidence >= 60 ? "中" : "要注意";

  return (
    <main style={S.page}>
      <section style={S.stage}>
        <div style={{ ...S.cameraLayer, background: active.bg }}>
          {cameraOn && <video ref={videoRef} playsInline muted style={S.video} />}
          {imageUrl && <img src={imageUrl} alt="" style={S.video} />}
          {!cameraOn && !imageUrl && (
            <div style={S.sceneFallback}>
              <div style={S.storefront}>
                <span style={S.storeSign}>{active.target}</span>
                <span style={S.menuSign}>{active.menu}</span>
              </div>
              <div style={S.streetLine} />
            </div>
          )}
          <div style={S.scanFrame}>
            <span style={S.cornerA} />
            <span style={S.cornerB} />
            <span style={S.cornerC} />
            <span style={S.cornerD} />
          </div>
          <div style={S.topHud}>
            <span style={S.liveDot} />
            <span>XR Preview</span>
            <span style={S.area}>{active.area}</span>
          </div>
        </div>

        <section style={S.overlayCard}>
          <div style={S.cardHead}>
            <div>
              <p style={S.eyebrow}>Taste Spoon Lens</p>
              <h1 style={S.title}>{active.target}</h1>
              <p style={S.menu}>{active.menu}</p>
            </div>
            <div style={{ ...S.verdict, borderColor: active.tone, color: active.tone }}>
              {active.verdict}
            </div>
          </div>

          <div style={S.confidenceRow}>
            <span style={S.confidenceLabel}>予測確度 {confidenceLabel}</span>
            <div style={S.meter}>
              <span style={{ ...S.meterFill, width: `${active.confidence}%`, background: active.tone }} />
            </div>
            <span style={{ ...S.percent, color: active.tone }}>{active.confidence}%</span>
          </div>

          <p style={S.summary}>{scanState === "scanning" ? "味覚センサーを照合中..." : active.summary}</p>

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

          <div style={S.reasonList}>
            {active.reasons.map((reason) => <span key={reason} style={S.reason}>{reason}</span>)}
          </div>

          <div style={S.altBox}>
            <span style={S.altLabel}>次の一手</span>
            <span>{active.alternative}</span>
          </div>
        </section>
      </section>

      <section style={S.controls}>
        <div style={S.targetRow}>
          {SCENES.map((scene) => (
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
              {scene.target}
            </button>
          ))}
        </div>

        <div style={S.actionRow}>
          <button type="button" style={S.primaryButton} onClick={cameraOn ? runScan : startCamera}>
            {cameraOn ? "再スキャン" : "カメラで見る"}
          </button>
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
    background: "#0f1310",
    color: "#f8f3e9",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "18px 14px 28px",
  },
  stage: {
    position: "relative",
    maxWidth: 980,
    minHeight: "min(760px, calc(100vh - 158px))",
    margin: "0 auto",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "#1b201b",
    boxShadow: "0 30px 90px rgba(0,0,0,0.42)",
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
  sceneFallback: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
  },
  storefront: {
    width: "min(78%, 620px)",
    minHeight: 220,
    display: "grid",
    alignContent: "center",
    gap: 18,
    padding: 28,
    borderRadius: 8,
    background: "rgba(255, 244, 219, 0.9)",
    color: "#2b2118",
    boxShadow: "0 24px 70px rgba(0,0,0,0.42)",
    transform: "perspective(700px) rotateX(2deg) rotateY(-4deg)",
  },
  storeSign: {
    fontSize: 44,
    fontWeight: 950,
    lineHeight: 1.02,
  },
  menuSign: {
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 6,
    background: "#2f241b",
    color: "#fff6e5",
    fontWeight: 850,
  },
  streetLine: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: "18%",
    height: 3,
    background: "rgba(255,255,255,0.34)",
  },
  scanFrame: {
    position: "absolute",
    left: "11%",
    top: "13%",
    width: "48%",
    height: "34%",
    minWidth: 220,
    minHeight: 160,
  },
  cornerA: corner("left", "top"),
  cornerB: corner("right", "top"),
  cornerC: corner("left", "bottom"),
  cornerD: corner("right", "bottom"),
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
    color: "rgba(255,255,255,0.86)",
    textShadow: "0 2px 12px rgba(0,0,0,0.45)",
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    background: "#51cf66",
    boxShadow: "0 0 18px #51cf66",
  },
  area: {
    marginLeft: "auto",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },
  overlayCard: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: "min(430px, calc(100% - 36px))",
    padding: 18,
    borderRadius: 8,
    background: "rgba(255, 251, 240, 0.92)",
    color: "#251c15",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 56px rgba(0,0,0,0.36)",
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
    fontSize: 30,
    lineHeight: 1.04,
    letterSpacing: 0,
  },
  menu: {
    margin: "7px 0 0",
    color: "#6b5a4a",
    fontWeight: 760,
  },
  verdict: {
    flex: "0 0 auto",
    border: "2px solid",
    borderRadius: 8,
    padding: "8px 10px",
    fontWeight: 950,
    fontSize: 17,
    background: "#fff",
  },
  confidenceRow: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 10,
    marginTop: 17,
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
  summary: {
    margin: "16px 0 0",
    fontSize: 15,
    lineHeight: 1.65,
    color: "#35291f",
    fontWeight: 680,
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
  reasonList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },
  reason: {
    borderRadius: 999,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
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
  altLabel: {
    color: "#f0c36b",
    fontSize: 11,
    fontWeight: 950,
  },
  controls: {
    maxWidth: 980,
    margin: "14px auto 0",
    display: "grid",
    gap: 12,
  },
  targetRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
    borderColor: "rgba(255,255,255,0.78)",
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
