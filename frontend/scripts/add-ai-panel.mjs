import { readFileSync, writeFileSync } from "node:fs";

function addImport(source, line) {
  return source.replace(/^import [^\n]*\n/, (first) => first + line + "\n");
}

// 1) The AI tools panel goes under the text of typed, voice, and scan notes
const editors = [
  { file: "src/components/TypedEditor.tsx", value: "content", setter: "setContent" },
  { file: "src/components/VoiceEditor.tsx", value: "text", setter: "setText" },
  { file: "src/components/ScanEditor.tsx", value: "text", setter: "setText" },
];
const errorLine = /^([ \t]*)\{error && <p className="auth-error">\{error\}<\/p>\}/m;

for (const { file, value, setter } of editors) {
  let s = readFileSync(file, "utf8");
  if (s.includes("AiToolsPanel")) {
    console.log(`${file}: already done`);
    continue;
  }
  if (!errorLine.test(s)) {
    console.log(`${file}: COULD NOT FIND THE SPOT`);
    continue;
  }
  s = s.replace(
    errorLine,
    (match, indent) =>
      `${indent}<AiToolsPanel\n${indent}  text={${value}}\n${indent}  onInsert={(t) => ${setter}((c) => (c ? c + "\\n\\n" : "") + t)}\n${indent}/>\n\n${match}`
  );
  s = addImport(s, 'import AiToolsPanel from "./AiToolsPanel";');
  writeFileSync(file, s);
  console.log(`${file}: AI panel added`);
}

// 2) The AI settings card goes into Settings
{
  const file = "src/pages/Settings.tsx";
  let s = readFileSync(file, "utf8");
  if (s.includes("AiSettingsCard")) {
    console.log(`${file}: already done`);
  } else {
    const installSpot = /^([ \t]*)<InstallCard \/>/m;
    const accountSpot = /^([ \t]*)<section className="card settings-section">\s*\n\s*<h3>Account<\/h3>/m;
    const spot = installSpot.test(s) ? installSpot : accountSpot.test(s) ? accountSpot : null;
    if (!spot) {
      console.log(`${file}: COULD NOT FIND THE SPOT`);
    } else {
      s = s.replace(spot, (match, indent) => `${indent}<AiSettingsCard />\n\n${match}`);
      s = addImport(s, 'import AiSettingsCard from "../components/AiSettingsCard";');
      writeFileSync(file, s);
      console.log(`${file}: AI settings card added`);
    }
  }
}
