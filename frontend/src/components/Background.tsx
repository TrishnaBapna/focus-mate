import { useEffect } from "react";
import { SCENES, type Scene } from "../utils/scene";

const CONFETTI_COLORS = ["#ff8a4c", "#ffd166", "#ef476f", "#06d6a0", "#9d8cff"];

function Stars({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 75}%`,
            animationDelay: `${(i % 7) * 0.45}s`,
            transform: `scale(${1 + (i % 3) * 0.4})`,
          }}
        />
      ))}
    </>
  );
}

function Clouds({ items }: { items: { top: string; duration: number; delay: number }[] }) {
  return (
    <>
      {items.map((c, i) => (
        <div
          key={i}
          className="cloud"
          style={{
            top: c.top,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function Confetti() {
  return (
    <>
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 29 + 5) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDuration: `${5 + (i % 5)}s`,
            animationDelay: `${-(i % 10) * 0.7}s`,
          }}
        />
      ))}
    </>
  );
}

function SceneDecor({ scene }: { scene: Scene }) {
  switch (scene) {
    case "sunrise":
      return (
        <>
          <div className="sun sun-low" />
          <Clouds
            items={[
              { top: "16%", duration: 100, delay: -30 },
              { top: "32%", duration: 130, delay: -90 },
            ]}
          />
        </>
      );
    case "afternoon":
      return (
        <>
          <div className="sun sun-high" />
          <Clouds
            items={[
              { top: "10%", duration: 90, delay: -20 },
              { top: "26%", duration: 120, delay: -70 },
              { top: "44%", duration: 150, delay: -110 },
            ]}
          />
        </>
      );
    case "sunset":
      return (
        <>
          <div className="sun sun-set" />
          <Clouds
            items={[
              { top: "14%", duration: 110, delay: -40 },
              { top: "30%", duration: 140, delay: -100 },
            ]}
          />
        </>
      );
    case "night":
      return (
        <>
          <div className="moon" />
          <Stars count={50} />
        </>
      );
    case "focus":
      return (
        <>
          <div className="blob b1" />
          <div className="blob b2" />
          <Stars count={30} />
        </>
      );
    case "break":
      return (
        <>
          <div className="blob b1" />
          <div className="blob b2" />
        </>
      );
    case "celebrate":
      return <Confetti />;
  }
}

export default function Background({ scene }: { scene: Scene }) {
  // Tell the CSS which scene is active (night/focus switch to dark cards)
  useEffect(() => {
    document.documentElement.dataset.scene = scene;
    return () => {
      delete document.documentElement.dataset.scene;
    };
  }, [scene]);

  return (
    <div className="bg-root" aria-hidden="true">
      {SCENES.map((s) => (
        <div key={s} className={`bg-layer bg-${s} ${s === scene ? "active" : ""}`}>
          <SceneDecor scene={s} />
        </div>
      ))}
    </div>
  );
}
