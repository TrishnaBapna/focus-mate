import { readFileSync, writeFileSync } from "node:fs";

// Each change says what happened, and does nothing if the spot can't be found.
function patch(file, find, replacement, done) {
  const source = readFileSync(file, "utf8");
  if (source.includes(done)) {
    console.log(`${file}: already done`);
    return;
  }
  if (!source.includes(find)) {
    console.log(`${file}: NOT CHANGED. Couldn't find the spot`);
    return;
  }
  writeFileSync(file, source.replace(find, () => replacement));
  console.log(`${file}: updated`);
}

// A "two people" icon for the menu
patch(
  "src/components/Icon.tsx",
  '  plus: <path d="M12 5v14M5 12h14" />,',
  '  users: (\n    <>\n      <circle cx="9" cy="8" r="3.2" />\n      <path d="M3 20a6 6 0 0 1 12 0" />\n      <circle cx="17" cy="9" r="2.5" />\n      <path d="M16 14.5a5 5 0 0 1 5 5.5" />\n    </>\n  ),\n  plus: <path d="M12 5v14M5 12h14" />,',
  "  users: ("
);

// The top bar says "Friends" on this page
patch(
  "src/components/TopBar.tsx",
  '  "/settings": "Settings",',
  '  "/friends": "Friends",\n  "/settings": "Settings",',
  '"/friends": "Friends"'
);
