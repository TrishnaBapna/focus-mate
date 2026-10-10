export type Scene =
  | "sunrise"
  | "afternoon"
  | "sunset"
  | "night"
  | "focus"
  | "break"
  | "celebrate"
  | "custom";

export const SCENES: Scene[] = [
  "sunrise",
  "afternoon",
  "sunset",
  "night",
  "focus",
  "break",
  "celebrate",
  "custom",
];

export function isScene(value: string | null): value is Scene {
  return value !== null && (SCENES as string[]).includes(value);
}

export function sceneForHour(hour: number): Scene {
  if (hour >= 5 && hour < 11) return "sunrise";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "sunset";
  return "night";
}
