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

// A chat-bubble icon for the menu
patch(
  "src/components/Icon.tsx",
  '  plus: <path d="M12 5v14M5 12h14" />,',
  '  chat: (\n    <>\n      <path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.1-3.6A8 8 0 0 1 4 12z" />\n      <path d="M9 11h6M9 14h4" />\n    </>\n  ),\n  plus: <path d="M12 5v14M5 12h14" />,',
  "  chat: ("
);

// The top bar shows "Assistant" on this page
patch(
  "src/components/TopBar.tsx",
  '  "/settings": "Settings",',
  '  "/assistant": "Assistant",\n  "/settings": "Settings",',
  '"/assistant": "Assistant"'
);
