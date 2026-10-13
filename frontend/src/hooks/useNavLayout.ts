import { useEffect, useState } from "react";

export type ScreenSize = "phone" | "tablet" | "desktop";

// On desktop show all items so nothing is hidden
function measure() {
  const w = window.innerWidth;
  const size: ScreenSize = w < 768 ? "phone" : w < 1100 ? "tablet" : "desktop";
  const count = size === "desktop" ? 14 : size === "tablet" ? 6 : 4;
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
