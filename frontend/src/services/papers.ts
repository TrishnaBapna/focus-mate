import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Paper } from "../types/paper";

export type PaperInput = Omit<Paper, "id" | "createdAt" | "updatedAt">;

const papersRef = (uid: string) => collection(db, "users", uid, "papers");

function cleanPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as Partial<T>;
}

export async function addPaper(uid: string, data: PaperInput): Promise<string> {
  const docRef = await addDoc(papersRef(uid), {
    ...cleanPayload(data as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export function updatePaper(uid: string, id: string, updates: Partial<Paper>): Promise<void> {
  return updateDoc(doc(db, "users", uid, "papers", id), {
    ...cleanPayload(updates as unknown as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  });
}

export function deletePaper(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(db, "users", uid, "papers", id));
}

export async function togglePaperActionItem(
  uid: string,
  paperId: string,
  actionId: string,
  completed: boolean
): Promise<void> {
  const paper = await getPaper(uid, paperId);
  if (!paper || !Array.isArray(paper.actionPlan)) return;
  const updatedPlan = paper.actionPlan.map((item) =>
    item.id === actionId ? { ...item, completed } : item
  );
  return updatePaper(uid, paperId, { actionPlan: updatedPlan });
}

export async function getPaper(uid: string, id: string): Promise<Paper | null> {
  const snap = await getDoc(doc(db, "users", uid, "papers", id));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Paper, "id">),
  };
}

// Order by date descending (most recent first)
export function listenToPapers(uid: string, callback: (papers: Paper[]) => void) {
  const q = query(papersRef(uid), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const data = d.data() as Omit<Paper, "id">;
          return {
            id: d.id,
            ...data,
            questions: data.questions ?? [],
            actionPlan: data.actionPlan ?? [],
            summary: data.summary ?? { totalQuestions: 0, maxMarks: 0 },
          };
        })
      );
    },
    (err) => {
      console.warn("listenToPapers error:", err);
    }
  );
}
