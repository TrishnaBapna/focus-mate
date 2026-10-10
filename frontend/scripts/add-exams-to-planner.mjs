import { readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/Planner.tsx";
const source = readFileSync(file, "utf8");

if (source.includes("dayExams")) {
  console.log(`${file}: already done`);
  process.exit(0);
}

const edits = [
  {
    name: "react-router import",
    find: 'import { useNavigate } from "react-router-dom";',
    replacement: 'import { Link, useNavigate } from "react-router-dom";',
  },
  {
    name: "exams hook import",
    find: 'import { useAuth } from "../hooks/useAuth";',
    replacement: 'import { useAuth } from "../hooks/useAuth";\nimport { useExams } from "../hooks/useExams";',
  },
  {
    name: "load exams",
    find: "const { sessions } = useSessions(500);",
    replacement: "const { sessions } = useSessions(500);\n  const { exams } = useExams();",
  },
  {
    name: "exam days",
    find: "const getMarks = (key: string) => ({",
    replacement:
      "const examDays = useMemo(() => new Set(exams.map((e) => e.date)), [exams]);\n\n  const getMarks = (key: string) => ({",
  },
  {
    name: "exam mark",
    find: "studied: studiedDays.has(key),",
    replacement: "studied: studiedDays.has(key),\n    exam: examDays.has(key),",
  },
  {
    name: "exams for the selected day",
    find: "const dayTasks = tasks.filter((t) => t.deadline === selectedKey);",
    replacement:
      "const dayTasks = tasks.filter((t) => t.deadline === selectedKey);\n  const dayExams = exams.filter((e) => e.date === selectedKey);",
  },
];

const agendaSpot = /^([ \t]*)\{dayTasks\.length > 0 && \(/m;

const missing = edits.filter((e) => !source.includes(e.find)).map((e) => e.name);
if (!agendaSpot.test(source)) missing.push("agenda spot");

if (missing.length > 0) {
  console.log(`${file}: NOT CHANGED. Couldn't find: ${missing.join(", ")}`);
  process.exit(1);
}

let next = source;
for (const edit of edits) next = next.replace(edit.find, () => edit.replacement);

const block = [
  "{dayExams.length > 0 && (",
  "  <>",
  "    <h4>Exams</h4>",
  '    <ul className="plan-list">',
  "      {dayExams.map((e) => (",
  '        <li key={e.id} className="plan-row">',
  '          <div className="plan-main">',
  '            <span className="plan-title">🎓 {e.name}</span>',
  "            {e.subjectName && (",
  '              <span className="task-meta">',
  "                {e.subjectEmoji} {e.subjectName}",
  "              </span>",
  "            )}",
  "          </div>",
  '          <Link to="/exams" className="btn secondary small">',
  "            Open",
  "          </Link>",
  "        </li>",
  "      ))}",
  "    </ul>",
  "  </>",
  ")}",
  "",
];

next = next.replace(agendaSpot, (match, indent) => {
  return block.map((line) => (line ? indent + line : line)).join("\n") + "\n" + match;
});

writeFileSync(file, next);
console.log(`${file}: exams added to the calendar and agenda`);
