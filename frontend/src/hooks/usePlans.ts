import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToPlans } from "../services/plans";
import type { Plan } from "../types";

export function usePlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenToPlans(user.uid, setPlans);
  }, [user]);

  return { plans };
}
