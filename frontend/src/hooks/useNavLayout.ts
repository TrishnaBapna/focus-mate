import { useEffect, useState } from "react";

export type ScreenSize = "phone" | "tablet" | "desktop";

export interface NavLayoutState {
  size: ScreenSize;
  count: number;
  phoneCount: number;
  width: number;
  height: number;
}

// Dynamically adapts icon counts to screen size:
// - Big screens / wide monitors: up to 6 or 7 icons, rest in More
// - Medium / laptop screens: 5 or 6 icons, rest in More
// - Tablets / small windows: 4 icons, rest in More
// - Small phones: 3 icons, rest in More
// - Standard phones: 4 icons, rest in More
function measure(): NavLayoutState {
  if (typeof window === "undefined") {
    return { size: "desktop", count: 6, phoneCount: 4, width: 1200, height: 800 };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const size: ScreenSize = w < 768 ? "phone" : w < 1100 ? "tablet" : "desktop";

  let count: number;
  if (w >= 1200 && h >= 680) {
    count = 7;
  } else if (w >= 1000 && h >= 580) {
    count = 6;
  } else if (w >= 768 && h >= 500) {
    count = 5;
  } else {
    count = 4;
  }

  const phoneCount = w < 370 ? 3 : 4;

  return { size, count, phoneCount, width: w, height: h };
}

export function useNavLayout() {
  const [state, setState] = useState<NavLayoutState>(measure);

  useEffect(() => {
    const onResize = () => setState(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return state;
}
