import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { calculateAccuracy, normalizeTopicKey } from "../utils/topicPerformance";
import type { AssessmentResult, ReviewedTopicRecord } from "../types/assessment";

const assessmentsRef = (uid: string) => collection(db, "users", uid, "assessments");
const reviewedTopicsRef = (uid: string) => collection(db, "users", uid, "reviewedTopics");

export type AssessmentInput = Omit<AssessmentResult, "id" | "createdAt" | "accuracy">;

/**
 * Persists an assessment result (from a quiz, flashcard review, or test) under users/{uid}/assessments.
 * Automatically invalidates any existing reviewed marker so fresh evidence takes effect immediately.
 */
export async function addAssessment(uid: string, data: AssessmentInput): Promise<string> {
  const accuracy = calculateAccuracy(data.score, data.totalQuestions);
  const ref = await addDoc(assessmentsRef(uid), {
    ...data,
    accuracy,
    createdAt: serverTimestamp(),
  });

  try {
    const topicKey = normalizeTopicKey(data.subjectId, data.topic);
    const docId = docIdForTopicKey(topicKey);
    const targetDoc = doc(db, "users", uid, "reviewedTopics", docId);
    await deleteDoc(targetDoc).catch(() => {});
  } catch {
    // non-blocking
  }

  return ref.id;
}

/**
 * Real-time listener for user assessments, ordered newest first.
 */
export function listenToAssessments(
  uid: string,
  callback: (assessments: AssessmentResult[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(assessmentsRef(uid), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AssessmentResult, "id">),
      }));
      callback(list);
    },
    (err) => {
      console.warn("listenToAssessments error:", err);
      onError?.(err);
    }
  );
}

/**
 * Encodes topicKey into a safe Firestore document ID.
 */
function docIdForTopicKey(topicKey: string): string {
  return encodeURIComponent(topicKey.toLowerCase().trim()).replace(/\./g, "%2E");
}

/**
 * Toggles a topic's reviewed status without altering any historical assessment data.
 */
export async function setTopicReviewed(
  uid: string,
  topicKey: string,
  topic: string,
  subjectId: string,
  reviewed: boolean
): Promise<void> {
  const docId = docIdForTopicKey(topicKey);
  const targetDoc = doc(db, "users", uid, "reviewedTopics", docId);

  if (reviewed) {
    await setDoc(targetDoc, {
      topicKey,
      topic,
      subjectId: subjectId || "",
      reviewedAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(targetDoc).catch(() => {});
  }
}

/**
 * Listens to reviewed topics for the authenticated user, returning a Map<topicKey, ISO_date>.
 */
export function listenToReviewedTopics(
  uid: string,
  callback: (reviewedMap: Map<string, string>) => void,
  onError?: (err: unknown) => void
) {
  return onSnapshot(
    reviewedTopicsRef(uid),
    (snap) => {
      const map = new Map<string, string>();
      for (const d of snap.docs) {
        const data = d.data() as ReviewedTopicRecord;
        if (data.topicKey) {
          const iso = data.reviewedAt?.toDate
            ? data.reviewedAt.toDate().toISOString()
            : new Date().toISOString();
          map.set(data.topicKey, iso);
        }
      }
      callback(map);
    },
    (err) => {
      console.warn("listenToReviewedTopics error:", err);
      onError?.(err);
    }
  );
}
