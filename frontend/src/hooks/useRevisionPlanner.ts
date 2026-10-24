import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { useExams } from "./useExams";
import { usePapers } from "./usePapers";
import { useSubjects } from "./useSubjects";
import { useTopicPerformance } from "./useTopicPerformance";
import { addPlan } from "../services/plans";
import { addTask } from "../services/tasks";
import {
  listenToRevisionTasks,
  rescheduleRevisionTask,
  setRevisionTaskStatus,
  type RevisionTaskRecord,
} from "../services/revisionPlanner";
import {
  computeSubjectRevisionProgress,
  filterRevisionTasks,
  generatePersonalizedRevisionTasks,
  getTodayDateString,
} from "../utils/revisionPlanner";
import type { RevisionFilterTab, RevisionTask, RevisionTaskStatus } from "../types/revision";

export function useRevisionPlanner() {
  const { user } = useAuth();
  const { papers, loading: papersLoading } = usePapers();
  const { exams, loading: examsLoading } = useExams();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { topics, loading: topicsLoading } = useTopicPerformance();

  const [savedRecords, setSavedRecords] = useState<RevisionTaskRecord[]>([]);
  const [filter, setFilter] = useState<RevisionFilterTab>("today");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayDate = useMemo(() => getTodayDateString(), []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToRevisionTasks(user.uid, (records) => {
      setSavedRecords(records);
    });

    return unsubscribe;
  }, [user]);

  // Generate personalized revision tasks synthesized from all evidence sources
  const allTasks = useMemo(() => {
    return generatePersonalizedRevisionTasks({
      papers,
      exams,
      subjects,
      topics,
      savedRecords,
      todayDate,
    });
  }, [papers, exams, subjects, topics, savedRecords, todayDate]);

  // Sliced task views
  const todayTasks = useMemo(
    () => filterRevisionTasks(allTasks, "today", todayDate),
    [allTasks, todayDate]
  );
  const upcomingTasks = useMemo(
    () => filterRevisionTasks(allTasks, "upcoming", todayDate),
    [allTasks, todayDate]
  );
  const overdueTasks = useMemo(
    () => filterRevisionTasks(allTasks, "overdue", todayDate),
    [allTasks, todayDate]
  );
  const completedTasks = useMemo(
    () => filterRevisionTasks(allTasks, "completed", todayDate),
    [allTasks, todayDate]
  );

  const currentFilteredTasks = useMemo(
    () => filterRevisionTasks(allTasks, filter, todayDate),
    [allTasks, filter, todayDate]
  );

  const subjectProgress = useMemo(
    () => computeSubjectRevisionProgress(allTasks, subjects, exams, todayDate),
    [allTasks, subjects, exams, todayDate]
  );

  function showFeedback(msg: string) {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3000);
  }

  function showError(err: string) {
    setErrorMessage(err);
    setTimeout(() => setErrorMessage(null), 4000);
  }

  // Task Status Mutator with bidirectional sync to paper action item
  async function updateStatus(taskId: string, status: RevisionTaskStatus) {
    if (!user) return;
    const task = allTasks.find((t) => t.id === taskId);
    setSavingTaskId(taskId);
    setErrorMessage(null);

    try {
      await setRevisionTaskStatus(user.uid, taskId, status, {
        paperId: task?.sourceId,
        actionId: task?.sourceActionId,
      });
      showFeedback(
        status === "completed"
          ? "Revision task completed! 🎉"
          : status === "in_progress"
          ? "Task marked in progress ⏳"
          : status === "skipped"
          ? "Task skipped ⏩"
          : "Task marked pending 📋"
      );
    } catch (err) {
      console.error("Error setting revision task status:", err);
      showError("Could not update task. Please try again.");
    } finally {
      setSavingTaskId(null);
    }
  }

  // Reschedule Task
  async function reschedule(taskId: string, newDate: string, notes?: string) {
    if (!user || !newDate) return;
    setSavingTaskId(taskId);
    setErrorMessage(null);

    try {
      await rescheduleRevisionTask(user.uid, taskId, newDate, notes);
      showFeedback(`Rescheduled to ${newDate} 📅`);
    } catch (err) {
      console.error("Error rescheduling revision task:", err);
      showError("Could not reschedule task. Please check the date.");
    } finally {
      setSavingTaskId(null);
    }
  }

  // Convert Revision Task into a Calendar Study Block (plans)
  async function scheduleToStudyCalendar(
    task: RevisionTask,
    startTime: string = "17:00",
    durationMinutes?: number
  ) {
    if (!user) return;
    setSavingTaskId(task.id);
    try {
      await addPlan(user.uid, {
        subjectId: task.subjectId || "general",
        subjectName: task.subjectName,
        subjectEmoji: task.subjectEmoji,
        topic: task.topic,
        date: task.dueDate || todayDate,
        startTime,
        durationMinutes: durationMinutes || task.suggestedDurationMinutes || 45,
        repeat: "none",
      });
      showFeedback(`Added to Study Calendar for ${task.dueDate} at ${startTime} 📅`);
    } catch (err) {
      console.error("Error scheduling study block:", err);
      showError("Failed to add study block to calendar.");
    } finally {
      setSavingTaskId(null);
    }
  }

  // Add to main FocusMate tasks
  async function exportToMainTasks(task: RevisionTask) {
    if (!user) return;
    setSavingTaskId(task.id);
    try {
      await addTask(user.uid, {
        title: task.title,
        subjectId: task.subjectId || "",
        subjectName: task.subjectName,
        subjectEmoji: task.subjectEmoji,
        priority: task.priority === "urgent" ? "high" : task.priority,
        deadline: task.dueDate,
        estimatedMinutes: task.suggestedDurationMinutes,
      });
      showFeedback("Added to your main Tasks list ✅");
    } catch (err) {
      console.error("Error exporting to tasks:", err);
      showError("Failed to add to main Tasks.");
    } finally {
      setSavingTaskId(null);
    }
  }

  const loading = papersLoading || examsLoading || subjectsLoading || topicsLoading;

  return {
    allTasks,
    currentFilteredTasks,
    todayTasks,
    upcomingTasks,
    overdueTasks,
    completedTasks,
    subjectProgress,
    filter,
    setFilter,
    loading,
    savingTaskId,
    feedbackMessage,
    errorMessage,
    todayDate,
    updateStatus,
    reschedule,
    scheduleToStudyCalendar,
    exportToMainTasks,
  };
}
