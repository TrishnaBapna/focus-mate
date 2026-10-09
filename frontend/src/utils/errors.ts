// Turns a Firebase error into a sentence a person can act on
export function describeError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (code.includes("permission-denied")) {
    return "Firestore blocked this request (permission denied). In the Firebase console, open Firestore Database → Rules and check that your rules are published.";
  }
  if (code.includes("unavailable")) {
    return "Couldn't reach the database. Check your internet connection (and any ad-blocker).";
  }
  if (code.includes("failed-precondition")) {
    return "Firestore needs an index for this. Open the browser console for a link that creates it.";
  }
  const message = err instanceof Error ? err.message : "";
  return message || "Something went wrong.";
}

// Gives up waiting after a while (a save that is still pending is not lost)
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}
