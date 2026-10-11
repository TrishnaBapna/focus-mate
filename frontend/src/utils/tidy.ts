const PAGE_MARK = /^—\s*Page\s+\d+\s*—$/;
const BULLET = /^\s*([•\-*–]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/;

// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up text that came from// Cleans up t

    if (joinable) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}
