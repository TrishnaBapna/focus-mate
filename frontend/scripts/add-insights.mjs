import { readFileSync, writeFileSync } from "node:fs";

// 1) The weekly report goes at the top of the Analytics page
{
  const file = "src/pages/Analytics.tsx";
  let s = readFileSync(file, "utf8");
  const spot = /^([ \t]*)<div className="stat-grid">/m;
  if (s.includes("WeeklyReportCard")) {
    console.log(`${file}: already done`);
  } else if (!spot.test(s)) {
    console.log(`${file}: COULD NOT FIND THE SPOT`);
  } else {
    s = s.replace(spot, (match, indent) => `${indent}<WeeklyReportCard />\n\n${match}`);
    s = s.replace(
      /^import [^\n]*\n/,
      (first) => first + 'import WeeklyReportCard from "../components/WeeklyReportCard";\n'
    );
    writeFileSync(file, s);
    console.log(`${file}: weekly report added`);
  }
}

// 2) The achievements provider shares the sessions and tasks it already loaded
{
  const file = "src/hooks/AchievementsProvider.tsx";
  let s = readFileSync(file, "utf8");
  const before = "value={{ progress, ready, unlockedAt: stored?.unlocked ?? {} }}";
  const after = "value={{ progress, ready, unlockedAt: stored?.unlocked ?? {}, sessions, tasks }}";
  if (s.includes(after)) {
    console.log(`${file}: already done`);
  } else if (!s.includes(before)) {
    console.log(`${file}: COULD NOT FIND THE SPOT`);
  } else {
    writeFileSync(file, s.replace(before, after));
    console.log(`${file}: now shares sessions and tasks`);
  }
}
