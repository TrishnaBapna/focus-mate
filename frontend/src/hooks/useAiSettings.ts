import { useSyncExternalStore } from "react";
import { getApiKeyFor, getModelFor, getProvider, subscribeAi } from "../utils/aiSettings";

// The provider currently in use, plus its key and model
export function useAiSettings() {
  const provider = useSyncExternalStore(subscribeAi, getProvider);
  const apiKey = useSyncExternalStore(subscribeAi, () => getApiKeyFor(getProvider()));
  const model = useSyncExternalStore(subscribeAi, () => getModelFor(getProvider()));
  return { provider, apiKey, model };
}
