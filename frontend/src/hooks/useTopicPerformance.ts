import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { useExams } from "./useExams";
import {
  addAssessment,
  listenToAssessments,
  listenToReviewedTopics,
  setTopicReviewed,
  type AssessmentInput,
} from "../services/assessments";
import {
  buildRevisionRecommendations,
  classifyTopicPerformance,
} from "../utils/topicPerformance";
import type { AssessmentResult } from "../types/assessment";

export function useTopicPerformance() {
  const { user } = useAuth();
  const { exams } = useExams();
  const [assessments, setAssessments] = useState<AssessmentResult[]>([]);
  const [reviewedMap, setReviewedMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubAssessments = listenToAssessments(
      user.uid,
      (list) => {
        setAssessments(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubReviewed = listenToReviewedTopics(user.uid, (map) => {
      setReviewedMap(map);
    });

    return () => {
      unsubAssessments();
      unsubReviewed();
    };
  }, [user]);

  const topics = useMemo(
    () => classifyTopicPerformance(assessments, { reviewedMap }),
    [assessments, reviewedMap]
  );

  const recommendations = useMemo(
    () => buildRevisionRecommendations(topics, exams, reviewedMap),
    [topics, exams, reviewedMap]
  );

  const weakTopics = useMemo(
    () => topics.filter((t) => t.status === "needs_revision"),
    [topics]
  );

  const improvingTopics = useMemo(
    () => topics.filter((t) => t.status === "improving"),
    [topics]
  );

  const onTrackTopics = useMemo(
    () => topics.filter((t) => t.status === "on_track"),
    [topics]
  );

  const needsDataTopics = useMemo(
    () => topics.filter((t) => t.status === "not_enough_data"),
    [topics]
  );

  async function toggleReviewed(
    topicKey: string,
    topic: string,
    subjectId: string,
    markAsReviewed: boolean
  ) {
    if (!user) return;
    await setTopicReviewed(user.uid, topicKey, topic, subjectId, markAsReviewed);
  }

  async function recordNewAssessment(data: AssessmentInput) {
    if (!user) return;
    return await addAssessment(user.uid, data);
  }

  return {
    assessments,
    topics,
    weakTopics,
    improvingTopics,
    onTrackTopics,
    needsDataTopics,
    recommendations,
    loading,
    toggleReviewed,
    recordNewAssessment,
  };
}
