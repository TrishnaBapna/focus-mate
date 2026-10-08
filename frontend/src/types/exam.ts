import type { Timestamp } from "firebase/firestore";

export interface SyllabusItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Exam {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  date: string; // "YYYY-MM-DD"
  syllabus: SyllabusItem[];
  createdAt?: Timestamp | null;
}
