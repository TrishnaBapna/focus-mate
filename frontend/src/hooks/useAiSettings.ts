import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { getApiKeyFor, getModelFor, getProvider, subscribeAi } from "../utils/aiSettings";

// The provider currently in use, plus its key and model, scoped to the current user
export function useAiSettings() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const getProviderSnapshot = useCallback(() => getProvider(uid), [uid]);
  const getApiKeySnapshot = useCallback(() => getApiKeyFor(getProvider(uid), uid), [uid]);
  const getModelSnapshot = useCallback(() => getModelFor(getProvider(uid), uid), [uid]);

  const provider = useSyncExternalStore(subscribeAi, getProviderSnapshot);
  const apiKey = useSyncExternalStore(subscribeAi, getApiKeySnapshot);
  const model = useSyncExternalStore(subscribeAi, getModelSnapshot);

  return { provider, apiKey, model };
}
