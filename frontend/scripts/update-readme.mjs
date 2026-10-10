import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "../README.md";
if (!existsSync(file)) {
  console.log("README.md not found one folder up. Nothing changed.");
  process.exit(1);
}

let s = readFileSync(file, "utf8");
if (s.includes("### Study")) {
  console.log("README already has a Study section. Nothing changed.");
  process.exit(0);
}

const changes = [];

const study = `### Study
- **Flashcard decks** you build yourself (add cards one by one, or paste many at once)
- **Spaced repetition**: cards you remember come back in 1, 3, 7, 14, then 30 days, and missed cards return in the same session
- **Optional AI study tools** inside notes: summaries, simple explanations, key points, formulas, quizzes, and flashcards. You bring your own API key (a free Google Gemini key works, or an Anthropic key). The key stays in your browser, and a note's text is only sent when you press a tool button

`;
if (s.includes("### Insights")) {
  s = s.replace("### Insights", () => study + "### Insights");
  changes.push("added the Study section");
}

s = s.replace(/^- \*\*Analytics\*\*.*$/m, (line) => {
  changes.push("added the suggestions and weekly report bullet");
  return (
    line +
    "\n- **Smart suggestions and a weekly report**, worked out from your own data (no AI needed): exam prep nudges, overdue tasks, streak reminders, and your strongest and least-studied subjects"
  );
});

s = s.replace(/^\| OCR \|.*$/m, (line) => {
  changes.push("added the AI row to the tech stack");
  return (
    line +
    "\n| AI (optional) | Google Gemini or Anthropic Claude, called from the browser with your own API key |"
  );
});

s = s.replace(/^  exams\/.*$/m, (line) => {
  changes.push("added decks and cards to the data model");
  return (
    line +
    "\n  decks/      flashcard decks\n  cards/      flashcards with their next review date"
  );
});

s = s.replace(/^(- \*\*Privacy by design:\*\*.*)$/m, (line) => {
  changes.push("extended the privacy note");
  return line + " AI tools only send a note's text to the AI provider when you press a tool button, using a key you provide.";
});

if (/\n\n## Roadmap/.test(s)) {
  s = s.replace(
    /\n\n## Roadmap/,
    "\n- **AI tools** need your own API key. The free Gemini tier has usage limits, and Google may use free-tier content to improve its products\n\n## Roadmap"
  );
  changes.push("added an AI note to the known limits");
}

for (const [oldLine, newLine] of [
  [
    "- [ ] AI study tools: summaries, quizzes, and flashcards from notes",
    "- [x] AI study tools: summaries, quizzes, and flashcards from notes",
  ],
  [
    "- [ ] Weekly progress report and smart study recommendations",
    "- [x] Weekly progress report and smart study recommendations",
  ],
]) {
  if (s.includes(oldLine)) {
    s = s.replace(oldLine, newLine);
    changes.push("ticked off a roadmap item");
  }
}

if (changes.length === 0) {
  console.log("Couldn't find the expected spots in README.md. Nothing changed.");
} else {
  writeFileSync(file, s);
  console.log("README updated:\n- " + changes.join("\n- "));
}
