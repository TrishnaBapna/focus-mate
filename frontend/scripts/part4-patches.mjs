import { readFileSync, writeFileSync } from "node:fs";

// Each file is changed all-or-nothing, and the script says what happened.
function patch(file, edits) {
  const source = readFileSync(file, "utf8");
  if (edits.every((e) => source.includes(e.done))) {
    console.log(`${file}: already done`);
    return;
  }
  const found = (e) => (typeof e.find === "string" ? source.includes(e.find) : e.find.test(source));
  const missing = edits.filter((e) => !found(e)).map((e) => e.name);
  if (missing.length > 0) {
    console.log(`${file}: NOT CHANGED. Couldn't find: ${missing.join(", ")}`);
    return;
  }
  let next = source;
  for (const e of edits) {
    next = next.replace(e.find, typeof e.replacement === "function" ? e.replacement : () => e.replacement);
  }
  writeFileSync(file, next);
  console.log(`${file}: updated`);
}

// 1) The background layers know about the new "classic" scene
patch("src/components/Background.tsx", [
  {
    name: "custom case",
    find: /^([ \t]*)case "custom":/m,
    replacement: (match, indent) => `${indent}case "classic":\n${match}`,
    done: 'case "classic":',
  },
]);

// 2) Settings lists "Classic" as a background
patch("src/pages/Settings.tsx", [
  {
    name: "Automatic tile",
    find: '{ id: "auto", label: "Automatic" },',
    replacement: '{ id: "auto", label: "Automatic" },\n  { id: "classic", label: "Classic" },',
    done: 'id: "classic"',
  },
]);

// 3) The garden moves to the Awards page
patch("src/pages/Achievements.tsx", [
  {
    name: "level card",
    find: /^([ \t]*)<section className="card level-card">/m,
    replacement: (match, indent) => `${indent}<GardenCard />\n\n${match}`,
    done: "<GardenCard />",
  },
  {
    name: "first import",
    find: /^import [^\n]*\n/,
    replacement: (first) => first + 'import GardenCard from "../components/GardenCard";\n',
    done: "import GardenCard",
  },
]);
