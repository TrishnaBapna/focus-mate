import { useLocation, useSearchParams } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";
import { useHour } from "../hooks/useHour";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { useSettings } from "../hooks/useSettings";
import { isScene, sceneForHour, type Scene } from "../utils/scene";
import Background from "./Background";

export default function AppBackground() {
  const { phase } = useFocus();
  const { settings } = useSettings();
  const hour = useHour();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const forced = params.get("scene"); // handy for testing: /?scene=night
  const { url: customUrl } = useMediaUrl(settings.customBackgroundId || undefined);

  const choice = settings.background;
  const base: Scene = choice === "classic" ? "classic" : sceneForHour(hour);
  let scene: Scene = base;

  if (choice === "auto" || choice === "classic") {
    // These two follow what you're doing: focus, break, and celebration scenes
    if (phase === "focus") scene = "focus";
    else if (phase === "break") scene = "break";
    else if (phase === "focusDone" && pathname === "/focus") scene = "celebrate";
  } else {
    scene = choice; // a background picked in Settings stays fixed
  }

  if (isScene(forced)) scene = forced;
  if (scene === "custom" && !customUrl) scene = base;

  return <Background scene={scene} customUrl={customUrl ?? undefined} />;
}
