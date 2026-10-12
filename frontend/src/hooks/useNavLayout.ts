import { useEffect, useState } from "react";

export type ScreenSize = "phone" | "tablet" | "desktop";

// How many menu icons to show before "More": 4 normally, up to 7 on big monitors
function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const size: ScreenSize = w < 768 ? "phone" : w < 1100 ? "tablet" : "desktop";
  const count = size === "desktop" && w >= 1280 && h >= 900 ? 7 : 4;
  return { size, count };
}

export function useNavLayout() {
  const [state, setState] = useState(measure);

  useEffect(() => {
    const onResize = () => setState(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return state;
}
