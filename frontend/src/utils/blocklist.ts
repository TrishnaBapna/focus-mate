// Helpers for the Distraction Block List.
//
// IMPORTANT: a web page cannot block other sites or apps. These helpers only build
// text the student can choose to run on their own computer (the Mac hosts-file command).
// Because that text is pasted into a terminal with `sudo`, every domain is strictly
// validated here so a typed name can never inject shell commands.

export const HOSTS_MARKER = "# focusmate-block";

// Known distractions -> the real domains to block. Names are matched in lower case.
export const KNOWN_DOMAINS: Record<string, string[]> = {
  youtube: ["youtube.com", "m.youtube.com", "youtu.be"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  x: ["x.com", "twitter.com"],
  twitter: ["twitter.com", "x.com"],
  telegram: ["telegram.org", "web.telegram.org", "t.me"],
  snapchat: ["snapchat.com", "web.snapchat.com"],
  whatsapp: ["web.whatsapp.com"],
  reddit: ["reddit.com"],
  facebook: ["facebook.com"],
  netflix: ["netflix.com"],
  games: ["discord.com", "store.steampowered.com", "twitch.tv"],
};

// Letters, digits, dots and hyphens only, with at least one dot (e.g. "example.com").
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function isSafeDomain(value: string): boolean {
  return DOMAIN_RE.test(value);
}

// Turns what the student typed ("https://www.Example.com/watch") into "example.com",
// or null when it is not a real domain.
export function normalizeDomain(input: string): string | null {
  let v = input.trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, ""); // remove http://
  v = v.split(/[/?#]/)[0]; // remove path, query
  v = v.replace(/^www\./, "");
  return isSafeDomain(v) ? v : null;
}

export interface ResolvedBlockList {
  domains: string[]; // safe, de-duplicated, ready for a hosts file
  skipped: string[]; // list entries we could not turn into a domain (apps like "Games")
}

export function resolveBlockList(names: string[]): ResolvedBlockList {
  const domains = new Set<string>();
  const skipped: string[] = [];

  for (const name of names) {
    const known = KNOWN_DOMAINS[name.trim().toLowerCase()];
    if (known) {
      known.forEach((d) => domains.add(d));
      continue;
    }
    const typed = normalizeDomain(name);
    if (typed) domains.add(typed);
    else skipped.push(name);
  }

  return { domains: [...domains], skipped };
}

// One hosts-file line per domain. Every line ends with HOSTS_MARKER so we can remove
// exactly our own lines later, and nothing else.
export function buildBlockCommand(domains: string[]): string {
  const safe = domains.filter(isSafeDomain);
  if (safe.length === 0) return "";
  // "www." only makes sense for a main domain such as youtube.com, not for m.youtube.com
  const lines = safe.flatMap((d) => {
    const out = [`127.0.0.1 ${d} ${HOSTS_MARKER}`];
    if (d.split(".").length === 2) out.push(`127.0.0.1 www.${d} ${HOSTS_MARKER}`);
    return out;
  });
  const printfArgs = lines.map((l) => `'${l}\\n'`).join(" ");
  return `sudo sh -c "printf %b ${printfArgs} >> /etc/hosts && dscacheutil -flushcache"`;
}

// Removes ONLY the lines FocusMate added. It never touches the system's own
// "127.0.0.1 localhost" line.
export function buildUnblockCommand(): string {
  return `sudo sed -i '' '/${HOSTS_MARKER}$/d' /etc/hosts && sudo dscacheutil -flushcache`;
}
