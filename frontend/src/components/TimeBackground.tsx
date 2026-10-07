import { useHour } from "../hooks/useHour";
import { sceneForHour } from "../utils/scene";
import Background from "./Background";

// Time-of-day background for pages outside the main app (like login)
export default function TimeBackground() {
  const hour = useHour();
  return <Background scene={sceneForHour(hour)} />;
}
