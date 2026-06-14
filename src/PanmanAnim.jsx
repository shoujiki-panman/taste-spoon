import React, { useEffect, useState } from "react";

// 状態ごとの正直パンマン表現
//  - frames が2枚以上: setInterval でパラパラ切替（手・表情が動く）
//  - frames が1枚: css クラスで動かす（首かしげ / shake / 揺れ）
const SETS = {
  idle: { frames: ["idle", "idle2"], interval: 700 }, // 虫眼鏡で立つ⇔指さし
  good: { frames: ["good", "good2"], interval: 500 }, // 万歳⇔飛んで喜ぶ
  hmm: { frames: ["hmm"], css: "panman-tilt" }, // 困り＋首をかしげる
  bad: { frames: ["bad"], css: "panman-shake" }, // 怒り＋小刻みに揺れる
  loading: { frames: ["loading"], css: "panman-sway" }, // PC作業＋軽く揺らす
};

export default function PanmanAnim({ state = "idle", size = 112, alt = "正直パンマン" }) {
  const set = SETS[state] ?? SETS.idle;
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    if (set.frames.length < 2) return undefined;
    const id = setInterval(
      () => setI((p) => (p + 1) % set.frames.length),
      set.interval
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <img
      className={set.css || ""}
      src={`/panman/${set.frames[i]}.png`}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}
