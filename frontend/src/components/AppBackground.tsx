import { useLocation, useSearchParams } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";
import { useHour } from "../hooks/useHour";
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

  let scene: Scene = sceneForHour(hour);
  if (phase === "focus") scene = "focus";
  else if (phase === "break") scene = "break";
  else if (phase === "focusDone" && pathname === "/focus") scene = "celebrate";

  // A background chosen in Settings always wins over the automatic one
  if (settings.background !== "auto") scene = settings.background;
  if (isScene(forced)) scene = forced;

  return <Background scene={scene} />;
}
