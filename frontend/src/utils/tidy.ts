const PAGE_MARK = /^—\s*Page\s+\d+\s*—$/;
const BULLET = /^\s*([•\-*–]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/;

// Cleans up text extracted from scanned pages or PDFs.
export function tidyText(input: string): string {
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!normalized) return "";

  const lines = normalized.split("\n").map((line) => line.trim());
  const out: string[] = [];

  for (const line of lines) {
    if (!line || PAGE_MARK.test(line)) {
      if (out.length > 0 && out[out.length - 1] !== "") {
        out.push("");
      }
      continue;
    }

    const prev = out[out.length - 1] ?? "";
    const joinable =
      prev !== "" &&
      !BULLET.test(line) &&
      !BULLET.test(prev) &&
      !/[.!?:;]$/.test(prev);

    if (joinable) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }

  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop();
  }

  return out.join("\n");
}


