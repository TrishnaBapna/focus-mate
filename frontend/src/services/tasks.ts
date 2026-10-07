import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Task, TaskStatus } from "../types";

export type TaskInput = Omit<Task, "id" | "createdAt" | "completedAt" | "status">;

const tasksRef = (uid: string) => collection(db, "users", uid, "tasks");

export function addTask(uid: string, data: TaskInput) {
  return addDoc(tasksRef(uid), {
    ...data,
    status: "todo",
    createdAt: serverTimestamp(),
    completedAt: null,
  });
}

export function setTaskStatus(uid: string, id: string, status: TaskStatus) {
  return updateDoc(doc(db, "users", uid, "tasks", id), {
    status,
    completedAt: status === "done" ? serverTimestamp() : null,
  });
}

export function deleteTask(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "tasks", id));
}

export function listenToTasks(uid: string, callback: (tasks: Task[]) => void) {
  const q = query(tasksRef(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Task, "id">),
      }))
    );
  });
}
