import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SubjectGoal } from "../types";

const goalsRef = (uid: string) => collection(db, "users", uid, "subjectGoals");

export async function addOrUpdateSubjectGoal(
  uid: string,
  subjectId: string,
  targetHours: number
): Promise<void> {
  if (!uid) throw new Error("User ID is required");
  if (!subjectId) throw new Error("Subject ID is required");

  // Validate target hours: must be greater than 0 and at most 168 hours in a week
  const cleanHours = Number(targetHours);
  if (isNaN(cleanHours) || cleanHours <= 0 || cleanHours > 168) {
    throw new Error("Weekly target must be between 0.1 and 168 hours.");
  }

  const roundedHours = Math.round(cleanHours * 10) / 10; // round to 1 decimal place

  await setDoc(
    doc(db, "users", uid, "subjectGoals", subjectId),
    {
      subjectId,
      targetHours: roundedHours,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteSubjectGoal(
  uid: string,
  subjectId: string
): Promise<void> {
  if (!uid || !subjectId) return;
  await deleteDoc(doc(db, "users", uid, "subjectGoals", subjectId));
}

export function listenToSubjectGoals(
  uid: string,
  callback: (goals: SubjectGoal[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    goalsRef(uid),
    (snap) => {
      const goals: SubjectGoal[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          subjectId: (data.subjectId as string) || d.id,
          targetHours: Number(data.targetHours) || 0,
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });
      callback(goals);
    },
    (err) => {
      console.warn("listenToSubjectGoals error:", err);
      if (onError) onError(err);
    }
  );
}
