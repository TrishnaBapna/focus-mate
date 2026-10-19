import {
  HOSTS_MARKER,
  buildBlockCommand,
  buildUnblockCommand,
  isSafeDomain,
  normalizeDomain,
  resolveBlockList,
} from "./blocklist.ts";

const assert = {
  strictEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

console.log("Running block list tests...");

// Domain validation
assert.strictEqual(isSafeDomain("youtube.com"), true, "plain domain");
assert.strictEqual(isSafeDomain("web.telegram.org"), true, "subdomain");
assert.strictEqual(isSafeDomain("a'; rm -rf ~; echo '.com"), false, "shell injection must be rejected");
assert.strictEqual(isSafeDomain("evil.com && reboot"), false, "spaces rejected");
assert.strictEqual(isSafeDomain("games"), false, "no dot = not a domain");
assert.strictEqual(isSafeDomain("$(whoami).com"), false, "command substitution rejected");

// Normalising what a student types
assert.strictEqual(normalizeDomain("https://www.Example.com/watch?v=1"), "example.com", "url -> domain");
assert.strictEqual(normalizeDomain("  Reddit.com "), "reddit.com", "trim + lowercase");
assert.strictEqual(normalizeDomain("Minecraft"), null, "app name is not a domain");

// Resolving the list
const r = resolveBlockList(["YouTube", "X", "Minecraft", "news.ycombinator.com", "youtube"]);
assert.strictEqual(r.domains.includes("youtube.com"), true, "youtube known");
assert.strictEqual(r.domains.includes("twitter.com"), true, "x also blocks twitter.com");
assert.strictEqual(r.domains.includes("news.ycombinator.com"), true, "typed domain kept");
assert.strictEqual(r.domains.filter((d) => d === "youtube.com").length, 1, "no duplicates");
assert.strictEqual(r.skipped.join(","), "Minecraft", "unknown app is reported, not turned into minecraft.com");

// Commands
assert.strictEqual(buildBlockCommand([]), "", "empty list -> no command");
assert.strictEqual(buildBlockCommand(["bad domain; rm -rf /"]), "", "unsafe domain never reaches the command");
const block = buildBlockCommand(["youtube.com"]);
assert.strictEqual(block.includes(`127.0.0.1 youtube.com ${HOSTS_MARKER}`), true, "block line tagged");
assert.strictEqual(block.includes(`127.0.0.1 www.youtube.com ${HOSTS_MARKER}`), true, "www line tagged");

const unblock = buildUnblockCommand();
assert.strictEqual(unblock.includes("localhost"), false, "unblock never mentions localhost");
assert.strictEqual(unblock.includes(`'/${HOSTS_MARKER}$/d'`), true, "unblock only removes tagged lines");

console.log("Block list tests passed.");
