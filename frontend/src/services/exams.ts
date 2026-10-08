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
import type { Exam, SyllabusItem } from "../types/exam";

export type ExamInput = Omit<Exam, "id" | "createdAt">;

const examsRef = (uid: string) => collection(db, "users", uid, "exams");

export function addExam(uid: string, data: ExamInput) {
  return addDoc(examsRef(uid), { ...data, createdAt: serverTimestamp() });
}

export function setSyllabus(uid: string, id: string, syllabus: SyllabusItem[]) {
  return updateDoc(doc(db, "users", uid, "exams", id), { syllabus });
}

export function deleteExam(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "exams", id));
}

// Soonest exam first
export function listenToExams(uid: string, callback: (exams: Exam[]) => void) {
  const q = query(examsRef(uid), orderBy("date"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => {
        const data = d.data() as Omit<Exam, "id">;
        return { id: d.id, ...data, syllabus: data.syllabus ?? [] };
      })
    );
  });
}
