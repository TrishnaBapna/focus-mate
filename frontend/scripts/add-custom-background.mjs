import { readFileSync, writeFileSync } from "node:fs";

// 1) Background.tsx: draw the person's photo on the "custom" layer
{
  const file = "src/components/Background.tsx";
  const source = readFileSync(file, "utf8");

  if (source.includes("customUrl")) {
    console.log(`${file}: already done`);
  } else {
    const edits = [
      {
        name: "component signature",
        find: "export default function Background({ scene }: { scene: Scene }) {",
        replacement:
          "export default function Background({ scene, customUrl }: { scene: Scene; customUrl?: string }) {",
      },
      {
        name: "background layer",
        find: '<div key={s} className={`bg-layer bg-${s} ${s === scene ? "active" : ""}`}>',
        replacement:
          '<div\n          key={s}\n          className={`bg-layer bg-${s} ${s === scene ? "active" : ""}`}\n          style={s === "custom" && customUrl ? { backgroundImage: `url(${customUrl})` } : undefined}\n        >',
      },
    ];
    const casePattern = /^([ \t]*)case "celebrate":/m;

    const missing = edits.filter((e) => !source.includes(e.find)).map((e) => e.name);
    if (!casePattern.test(source)) missing.push("celebrate case");

    if (missing.length > 0) {
      console.log(`${file}: NOT CHANGED. Couldn't find: ${missing.join(", ")}`);
    } else {
      let next = source;
      for (const edit of edits) next = next.replace(edit.find, () => edit.replacement);
      next = next.replace(
        casePattern,
        (match, indent) => `${indent}case "custom":\n${indent}  return null;\n${match}`
      );
      writeFileSync(file, next);
      console.log(`${file}: custom photo layer added`);
    }
  }
}

// 2) Settings.tsx: add the "My photo background" card
{
  const file = "src/pages/Settings.tsx";
  const source = readFileSync(file, "utf8");

  if (source.includes("CustomBackgroundCard")) {
    console.log(`${file}: already done`);
  } else {
    const spots = [
      /^([ \t]*)<AiSettingsCard \/>/m,
      /^([ \t]*)<InstallCard \/>/m,
      /^([ \t]*)<section className="card settings-section">\s*\n\s*<h3>Account<\/h3>/m,
    ];
    const spot = spots.find((s) => s.test(source));

    if (!spot) {
      console.log(`${file}: NOT CHANGED. Couldn't find a place for the card`);
    } else {
      let next = source.replace(spot, (match, indent) => `${indent}<CustomBackgroundCard />\n\n${match}`);
      next = next.replace(
        /^import [^\n]*\n/,
        (first) => first + 'import CustomBackgroundCard from "../components/CustomBackgroundCard";\n'
      );
      writeFileSync(file, next);
      console.log(`${file}: photo background card added`);
    }
  }
}
