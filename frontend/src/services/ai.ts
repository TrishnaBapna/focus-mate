import type { Provider } from "../utils/aiSettings";

interface AskOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  json?: boolean; // the answer should be JSON (quizzes, flashcards)
}

const NETWORK_ERROR = "Couldn't reach the AI service. Check your internet connection.";
const RETRY_DELAYS_MS = [1500, 4000]; // how long to wait before each automatic retry

// Thrown when the service is overloaded or having a hiccup (worth trying again)
class AiBusyError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? "";
  } catch {
    return "";
  }
}

function busy(detail: string) {
  return new AiBusyError(`The AI service is busy${detail ? ` ("${detail}")` : ""}.`);
}

async function askClaude({ apiKey, model, system, prompt, maxTokens }: AskOptions): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required for calls made straight from a browser
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  if (!res.ok) {
    const detail = await readErrorMessage(res);
    if (res.status === 401) throw new Error("The API key was rejected. Check it in Settings.");
    if (res.status === 403) throw new Error(`This key isn't allowed to do that. ${detail}`.trim());
    if (res.status === 429) throw new Error("Too many requests right now. Wait a moment and try again.");
    if (res.status >= 500) throw busy(detail);
    throw new Error(detail || `The AI request failed (error ${res.status}).`);
  }

  const data = await res.json();
  const blocks = (data.content ?? []) as { type: string; text?: string }[];
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

async function askGemini({ apiKey, model, system, prompt, maxTokens, json }: AskOptions): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          // Some Gemini models "think" first, and that uses part of this budget
          maxOutputTokens: Math.max(maxTokens * 4, 4096),
          temperature: 0.4,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  if (!res.ok) {
    const detail = await readErrorMessage(res);
    if (res.status === 400 && /api key/i.test(detail)) {
      throw new Error("The API key was rejected. Check it in Settings.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`The API key was rejected or isn't allowed. ${detail}`.trim());
    }
    if (res.status === 404) {
      throw new Error("That model wasn't found. Change the model name in Settings.");
    }
    if (res.status === 429) {
      throw new Error("You've hit the free-tier limit for now. Wait a minute (or until tomorrow) and try again.");
    }
    if (res.status >= 500) throw busy(detail);
    throw new Error(detail || `The AI request failed (error ${res.status}).`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();

  if (!text) {
    const reason = data.promptFeedback?.blockReason;
    throw new Error(
      reason
        ? `The AI couldn't answer for this note (${reason}).`
        : "The AI returned an empty answer. Please try again."
    );
  }
  return text;
}

// Sends one question to the chosen AI and returns the text of the answer.
// If the service is busy, it quietly tries again a couple of times first.
export async function askAi(options: AskOptions): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return options.provider === "gemini" ? await askGemini(options) : await askClaude(options);
    } catch (err) {
      if (!(err instanceof AiBusyError)) throw err;

      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      const tip =
        options.provider === "gemini"
          ? " Try again in a minute, or switch the model in Settings (for example to gemini-flash-lite-latest)."
          : " Try again in a moment.";
      throw new Error(err.message + tip);
    }
  }
}

// Pulls a JSON object out of an answer, even if it came wrapped in extra words
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end === -1) {
    throw new Error("The AI's answer wasn't in the expected format. Please try again.");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("The AI's answer wasn't in the expected format. Please try again.");
  }
}
