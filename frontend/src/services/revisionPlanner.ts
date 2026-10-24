import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { togglePaperActionItem } from "./papers";
import type { RevisionTask, RevisionTaskStatus } from "../types/revision";

export interface RevisionTaskRecord {
  id: string;
  status: RevisionTaskStatus;
  rescheduledDate?: string;
  notes?: string;
  updatedAt?: unknown;
  completedAt?: unknown;
  sourcePaperId?: string;
  sourceActionId?: string;
}

const revisionTasksRef = (uid: string) => collection(db, "users", uid, "revisionTasks");

function cleanPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as Partial<T>;
}

export function listenToRevisionTasks(
  uid: string,
  callback: (records: RevisionTaskRecord[]) => void
) {
  return onSnapshot(
    revisionTasksRef(uid),
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RevisionTaskRecord, "id">),
        }))
      );
    },
    (err) => {
      console.warn("listenToRevisionTasks error:", err);
    }
  );
}

export async function setRevisionTaskStatus(
  uid: string,
  taskId: string,
  status: RevisionTaskStatus,
  syncMeta?: { paperId?: string; actionId?: string }
): Promise<void> {
  const isCompleted = status === "completed";
  const docRef = doc(db, "users", uid, "revisionTasks", taskId);

  await setDoc(
    docRef,
    cleanPayload({
      id: taskId,
      status,
      completedAt: isCompleted ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
      sourcePaperId: syncMeta?.paperId,
      sourceActionId: syncMeta?.actionId,
    }),
    { merge: true }
  );

  // Synchronize with paper action item if this task originated from a paper action plan
  if (syncMeta?.paperId && syncMeta?.actionId) {
    try {
      await togglePaperActionItem(uid, syncMeta.paperId, syncMeta.actionId, isCompleted);
    } catch (err) {
      console.warn("Could not sync revision task completion to paper action item:", err);
    }
  }
}

export async function rescheduleRevisionTask(
  uid: string,
  taskId: string,
  newDate: string,
  notes?: string
): Promise<void> {
  const docRef = doc(db, "users", uid, "revisionTasks", taskId);
  await setDoc(
    docRef,
    cleanPayload({
      id: taskId,
      rescheduledDate: newDate,
      notes: notes ?? undefined,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

export async function saveRevisionTaskOverride(
  uid: string,
  task: Partial<RevisionTask> & { id: string }
): Promise<void> {
  const docRef = doc(db, "users", uid, "revisionTasks", task.id);
  await setDoc(
    docRef,
    {
      ...cleanPayload(task as unknown as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function deleteRevisionTaskRecord(uid: string, taskId: string): Promise<void> {
  return deleteDoc(doc(db, "users", uid, "revisionTasks", taskId));
}
