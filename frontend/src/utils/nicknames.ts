const ADJECTIVES = [
  "Brave", "Calm", "Clever", "Cosmic", "Curious", "Gentle", "Happy", "Lucky",
  "Mighty", "Quick", "Sunny", "Swift", "Witty", "Zesty", "Bright", "Cozy",
];

const ANIMALS = [
  { name: "Panda", emoji: "🐼" },
  { name: "Fox", emoji: "🦊" },
  { name: "Owl", emoji: "🦉" },
  { name: "Koala", emoji: "🐨" },
  { name: "Otter", emoji: "🦦" },
  { name: "Tiger", emoji: "🐯" },
  { name: "Whale", emoji: "🐳" },
  { name: "Penguin", emoji: "🐧" },
  { name: "Rabbit", emoji: "🐰" },
  { name: "Dolphin", emoji: "🐬" },
  { name: "Hedgehog", emoji: "🦔" },
  { name: "Turtle", emoji: "🐢" },
];

export const EMOJI_CHOICES = [
  "🐼", "🦊", "🦉", "🐨", "🦦", "🐯", "🐳", "🐧", "🐰", "🐬",
  "🦔", "🐢", "🌟", "🚀", "🎧", "📚", "🍀", "🔥", "🌈", "🦄",
];

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

// Something like "Brave Panda 42" with a matching emoji
export function randomIdentity() {
  const animal = pick(ANIMALS);
  const number = 10 + Math.floor(Math.random() * 90);
  return { nickname: `${pick(ADJECTIVES)} ${animal.name} ${number}`, emoji: animal.emoji };
}

// A basic filter. It can't catch everything, but it blocks the obvious.
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "slut", "whore",
  "porn", "nude", "rape", "nazi", "hitler", "nigg", "fag", "retard",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
};

function flatten(text: string) {
  return text
    .toLowerCase()
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
}

// Returns a message if the nickname isn't allowed, or null if it's fine
export function validateNickname(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < 3) return "Nicknames need at least 3 characters.";
  if (text.length > 20) return "Nicknames can be up to 20 characters.";
  if (!/^[\p{L}\p{N} _-]+$/u.test(text)) return "Use letters, numbers, spaces, - or _ only.";
  if (/\d{6,}/.test(text)) return "Please don't use phone numbers.";
  const flat = flatten(text);
  if (BLOCKED.some((word) => flat.includes(word))) return "Please choose a friendlier nickname.";
  return null;
}
