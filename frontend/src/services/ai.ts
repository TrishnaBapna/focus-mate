import { getAllowDirectBrowserFallback, type Provider } from "../utils/aiSettings";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

interface AskOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  json?: boolean; // the answer should be JSON (quizzes, flashcards)
}

async function askProxy(options: AskOptions): Promise<string> {
  const callProxy = httpsCallable<
    {
      provider: Provider;
      prompt: string;
      system: string;
      model: string;
      maxTokens: number;
      json?: boolean;
      userApiKey?: string;
    },
    { text: string; isPlatformKey?: boolean }
  >(functions, "askAiProxy");

  const res = await callProxy({
    provider: options.provider,
    prompt: options.prompt,
    system: options.system,
    model: options.model,
    maxTokens: options.maxTokens,
    json: options.json,
    userApiKey: options.apiKey ? options.apiKey.trim() : undefined,
  });

  return res.data.text;
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

// The secure server-side proxy (a Cloud Function) needs the Firebase Blaze plan. Until it is
// deployed and VITE_AI_PROXY_ENABLED=true is set, AI runs on a key that each person adds
// themselves, straight from their browser. No shared key ships inside this app.
const PROXY_ENABLED = import.meta.env.VITE_AI_PROXY_ENABLED === "true";

// Calls the chosen provider directly with the key the person added, retrying if it is busy.
async function askDirect(options: AskOptions): Promise<string> {
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
      throw new Error(err.message + tip, { cause: err });
    }
  }
}

// Sends one question to the chosen AI and returns the text of the answer.
// With the proxy off, it uses the key the person added, directly. With the proxy on, it tries
// the secure Cloud Function first and falls back to that key only if the proxy is unavailable
// and the person has opted in.
export async function askAi(options: AskOptions): Promise<string> {
  if (!PROXY_ENABLED) {
    if (!options.apiKey) {
      throw new Error("Add your own API key in Settings to use the AI features.");
    }
    return askDirect(options);
  }

  try {
    return await askProxy(options);
  } catch (proxyErr: unknown) {
    // 1. Platform-funded requests must NEVER fall back to direct browser calls
    if (!options.apiKey) {
      throw proxyErr;
    }

    const errCode = (proxyErr as { code?: string })?.code || "";
    const errorMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);

    // 2. Authentication, App Check, quota, rate limit, and validation errors MUST throw immediately
    // and must never silently trigger direct browser calls
    const isSecurityOrPolicyRejection =
      errCode.includes("unauthenticated") ||
      errCode.includes("permission-denied") ||
      errCode.includes("resource-exhausted") ||
      errCode.includes("invalid-argument") ||
      errCode.includes("failed-precondition") ||
      errorMsg.includes("You must be signed in") ||
      errorMsg.includes("Rate limit") ||
      errorMsg.includes("quota") ||
      errorMsg.includes("rejected by the provider");

    if (isSecurityOrPolicyRejection) {
      throw proxyErr;
    }

    // 3. Fallback requires both genuine proxy unavailability AND explicit user opt-in
    const isNetworkOrProxyUnavailable =
      errCode.includes("unavailable") ||
      errCode.includes("not-found") ||
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("network") ||
      errorMsg.includes("unavailable");

    const allowsDirectFallback = getAllowDirectBrowserFallback();

    if (isNetworkOrProxyUnavailable && allowsDirectFallback) {
      console.warn("AI Proxy unreachable; proceeding with user-authorized client-side BYOK fallback.");
    } else {
      throw proxyErr;
    }
  }

  return askDirect(options);
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
