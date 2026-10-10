import { readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/Dashboard.tsx";
const source = readFileSync(file, "utf8");

if (source.includes("GardenCard")) {
  console.log(`${file}: already done`);
  process.exit(0);
}

const spot = /^([ \t]*)<SuggestionsCard \/>/m;
if (!spot.test(source)) {
  console.log(`${file}: NOT CHANGED. Couldn't find <SuggestionsCard />`);
  process.exit(1);
}

let next = source.replace(spot, (match, indent) => `${indent}<GardenCard />\n\n${match}`);
next = next.replace(
  /^import [^\n]*\n/,
  (first) => first + 'import GardenCard from "../components/GardenCard";\n'
);
writeFileSync(file, next);
console.log(`${file}: garden card added`);
