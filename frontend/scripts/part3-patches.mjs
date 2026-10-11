import { readFileSync, writeFileSync } from "node:fs";

function patch(file, edits) {
  const source = readFileSync(file, "utf8");
  if (edits.every((e) => source.includes(e.after))) {
    console.log(`${file}: already done`);
    return;
  }
  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e) => !sourc  const missing = edits.filter((e)document",
    after: "pages?: { imageId: string; thumb: string }[]",
  },
]);

// 2) The AI panel asks for more output on long documents
patch("src/components/AiToolsPanel.tsx", [
  {
    name: "import list",
    find: "  buildPrompt,",
    replacement: "  buildPrompt,\n  tokensFor,",
    after: "tokensFor,",
  },
  {
    name: "token limit",
    find: "maxTokens: tool.maxTokens,",
    replacement: "maxTokens: tokensFor(tool, note),",
    after: "maxTokens: tokensFor(tool, note),",
  },
]);
