import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Plan } from "../types";

export type PlanInput = Omit<Plan, "id" | "createdAt">;

const plansRef = (uid: string) => collection(db, "users", uid, "plans");

export function addPlan(uid: string, data: PlanInput) {
  return addDoc(plansRef(uid), { ...data, createdAt: serverTimestamp() });
}

export function deletePlan(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "plans", id));
}

export function listenToPlans(uid: string, callback: (plans: Plan[]) => void) {
  const q = query(plansRef(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Plan, "id">),
      }))
    );
  });
}
