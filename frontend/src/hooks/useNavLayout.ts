import { useEffect, useState } from "react";
import { NAV_ITEMS, PHONE_NAV_COUNT } from "../components/navItems";

export type ScreenSize = "phone" | "tablet" | "desktop";

const ROW_HEIGHT = 58; // roughly how tall one sidebar button is

// How many menu buttons fit, based on the width AND the height of the window
function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const size: ScreenSize = w < 768 ? "phone" : w < 1100 ? "tablet" : "desktop";

  // Room left after padding, the Settings and Log out buttons, and a "More" button
  const rows = Math.floor((h - 40 - 32 - 2 * ROW_HEIGHT - ROW_HEIGHT) / ROW_HEIGHT);
  const widthCap = size === "phone" ? PHONE_NAV_COUNT : size === "tablet" ? 7 : NAV_ITEMS.length;
  const count = size === "phone" ? PHONE_NAV_COUNT : Math.max(4, Math.min(widthCap, rows));

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
