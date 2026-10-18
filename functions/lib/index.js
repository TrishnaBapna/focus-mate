"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAiProxy = exports.MAX_DAILY_REQUESTS = exports.MAX_REQUESTS_PER_MINUTE = void 0;
exports.checkDistributedRateLimit = checkDistributedRateLimit;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
// Define secrets stored securely in Google Cloud Secret Manager
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
const anthropicApiKey = (0, params_1.defineSecret)("ANTHROPIC_API_KEY");
// Model allowlists
const ALLOWED_GEMINI_MODELS = new Set([
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
]);
const ALLOWED_ANTHROPIC_MODELS = new Set([
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-sonnet-5-5",
]);
// Distributed rate limiting & abuse controls
exports.MAX_REQUESTS_PER_MINUTE = 15;
exports.MAX_DAILY_REQUESTS = 100; // Platform daily quota per student to prevent platform cost overruns
/**
 * Robust detection of deployed Cloud Functions / Cloud Run runtime.
 * Guarantees App Check is enforced in production even if NODE_ENV is left unset.
 */
const isDeployedRuntime = Boolean((process.env.K_SERVICE || process.env.FUNCTION_NAME || process.env.FUNCTION_TARGET || process.env.NODE_ENV === "production") &&
    process.env.FUNCTIONS_EMULATOR !== "true");
function sanitizeText(text, secret) {
    if (!secret)
        return text;
    return text.split(secret).join("[REDACTED]");
}
/**
 * Distributed, multi-instance-safe rate limiter backed by Firestore atomic transactions.
 * Operates across all autoscaled Cloud Function instances.
 * Fails closed for all requests if rate-limit verification fails, protecting both cloud budget and compute instances.
 */
async function checkDistributedRateLimit(uid, isPlatformKey, firestoreDb = db) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const todayKey = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD in UTC (resets at UTC midnight)
    const userRateLimitRef = firestoreDb.collection("systemRateLimits").doc(uid);
    try {
        return await firestoreDb.runTransaction(async (t) => {
            const snap = await t.get(userRateLimitRef);
            const data = snap.data() || {};
            // 1. Minute-level sliding window (applies to all users to protect function instances against DoS)
            const recentTimestamps = Array.isArray(data.timestamps)
                ? data.timestamps.filter((ts) => typeof ts === "number" && ts > oneMinuteAgo)
                : [];
            if (recentTimestamps.length >= exports.MAX_REQUESTS_PER_MINUTE) {
                return {
                    allowed: false,
                    reason: "Too many requests. Please wait a minute before making another request.",
                };
            }
            // 2. Platform daily quota (applies strictly to platform-funded calls to cap cloud cost)
            const dailyCount = data.dailyDate === todayKey && typeof data.dailyCount === "number" ? data.dailyCount : 0;
            if (isPlatformKey && dailyCount >= exports.MAX_DAILY_REQUESTS) {
                return {
                    allowed: false,
                    reason: "Daily AI study request limit reached. You can add your own free Gemini API key in Settings for unlimited practice.",
                };
            }
            recentTimestamps.push(now);
            t.set(userRateLimitRef, {
                timestamps: recentTimestamps,
                dailyDate: todayKey,
                dailyCount: isPlatformKey ? dailyCount + 1 : dailyCount,
                updatedAt: now,
            }, { merge: true });
            return { allowed: true };
        });
    }
    catch (err) {
        console.warn("Distributed rate limiter error:", err);
        // Fail-closed for all requests if rate-limit verification cannot be confirmed
        return {
            allowed: false,
            reason: "Rate limit verification is temporarily unavailable. Please try again shortly.",
        };
    }
}
/**
 * Server-Side AI Proxy Cloud Function
 */
exports.askAiProxy = (0, https_1.onCall)({
    secrets: [geminiApiKey, anthropicApiKey],
    // Enforce App Check in deployed runtime to guarantee calls originate from the genuine FocusMate web app
    enforceAppCheck: isDeployedRuntime,
    maxInstances: 10,
    timeoutSeconds: 60,
}, async (request) => {
    // 1. Authentication check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in to FocusMate to use AI study tools.");
    }
    const uid = request.auth.uid;
    // 2. Input validation
    const data = request.data;
    if (!data || typeof data !== "object") {
        throw new https_1.HttpsError("invalid-argument", "Missing request body.");
    }
    const provider = data.provider;
    if (provider !== "gemini" && provider !== "anthropic") {
        throw new https_1.HttpsError("invalid-argument", "Provider must be 'gemini' or 'anthropic'.");
    }
    const prompt = (data.prompt ?? "").trim();
    if (!prompt) {
        throw new https_1.HttpsError("invalid-argument", "Prompt cannot be empty.");
    }
    if (prompt.length > 25000) {
        throw new https_1.HttpsError("invalid-argument", "Prompt exceeds maximum allowed length (25,000 characters).");
    }
    const system = (data.system ?? "").trim();
    if (system.length > 5000) {
        throw new https_1.HttpsError("invalid-argument", "System prompt exceeds maximum allowed length (5,000 characters).");
    }
    const maxTokens = Math.min(Math.max(data.maxTokens ?? 1024, 64), 4096);
    const isJson = Boolean(data.json);
    // 3. Resolve API Key:
    // If user explicitly provided a key parameter, strictly use it and never fall back to platform secret.
    let effectiveKey = "";
    let isPlatformKey = false;
    const hasUserKey = data.userApiKey !== undefined && data.userApiKey !== null;
    const userSuppliedKey = typeof data.userApiKey === "string" ? data.userApiKey.trim() : "";
    if (hasUserKey) {
        if (!userSuppliedKey) {
            throw new https_1.HttpsError("invalid-argument", "Empty or invalid user API key provided.");
        }
        effectiveKey = userSuppliedKey;
        isPlatformKey = false;
    }
    else if (provider === "gemini") {
        const secret = geminiApiKey.value();
        if (secret) {
            effectiveKey = secret;
            isPlatformKey = true;
        }
    }
    else {
        const secret = anthropicApiKey.value();
        if (secret) {
            effectiveKey = secret;
            isPlatformKey = true;
        }
    }
    if (!effectiveKey) {
        throw new https_1.HttpsError("failed-precondition", `No ${provider === "gemini" ? "Google Gemini" : "Anthropic"} API key configured. Please add an API key in Settings.`);
    }
    // 4. Distributed Rate Limit & Quota enforcement
    const rateCheck = await checkDistributedRateLimit(uid, isPlatformKey);
    if (!rateCheck.allowed) {
        throw new https_1.HttpsError("resource-exhausted", rateCheck.reason || "Rate limit exceeded.");
    }
    // 5. Server-to-server inference execution
    try {
        if (provider === "gemini") {
            const model = data.model && ALLOWED_GEMINI_MODELS.has(data.model) ? data.model : "gemini-flash-latest";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": effectiveKey,
                },
                body: JSON.stringify({
                    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: Math.max(maxTokens * 4, 4096),
                        temperature: 0.4,
                        ...(isJson ? { responseMimeType: "application/json" } : {}),
                    },
                }),
            });
            if (!response.ok) {
                const detail = await response.text();
                console.error("Gemini upstream error:", response.status, sanitizeText(detail, effectiveKey));
                if (response.status === 400 && /api key/i.test(detail)) {
                    throw new https_1.HttpsError("invalid-argument", "The API key was rejected by the provider.");
                }
                if (response.status === 429) {
                    throw new https_1.HttpsError("resource-exhausted", "The AI provider is experiencing high traffic. Please try again shortly.");
                }
                throw new https_1.HttpsError("internal", "The AI service encountered an issue while generating a response.");
            }
            const body = (await response.json());
            const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
            if (!text) {
                const reason = body.promptFeedback?.blockReason;
                throw new https_1.HttpsError("failed-precondition", reason ? `The AI response was filtered (${reason}).` : "Empty AI response.");
            }
            return { text, isPlatformKey };
        }
        else {
            // Anthropic Claude
            const model = data.model && ALLOWED_ANTHROPIC_MODELS.has(data.model) ? data.model : "claude-haiku-4-5-20251001";
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": effectiveKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model,
                    max_tokens: maxTokens,
                    system: system || undefined,
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            if (!response.ok) {
                const detail = await response.text();
                console.error("Anthropic upstream error:", response.status, sanitizeText(detail, effectiveKey));
                if (response.status === 401 || response.status === 403) {
                    throw new https_1.HttpsError("permission-denied", "The Anthropic API key was rejected or unauthorized.");
                }
                if (response.status === 429) {
                    throw new https_1.HttpsError("resource-exhausted", "Anthropic rate limit reached. Please wait a moment.");
                }
                throw new https_1.HttpsError("internal", "The AI service encountered an upstream issue.");
            }
            const body = (await response.json());
            const text = body.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim() ?? "";
            return { text, isPlatformKey };
        }
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error("AI Proxy uncaught error:", sanitizeText(err instanceof Error ? err.message : String(err), effectiveKey));
        throw new https_1.HttpsError("internal", "Failed to communicate with the AI provider.");
    }
});
//# sourceMappingURL=index.js.map