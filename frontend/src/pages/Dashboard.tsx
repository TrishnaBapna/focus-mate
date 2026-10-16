import { useMemo } from "react";
import BlockListCard from "../components/BlockListCard";
import DashboardGoalsCard from "../components/DashboardGoalsCard";
import HeroCard from "../components/HeroCard";
import PerformanceCard from "../components/PerformanceCard";
import PomodoroCard from "../components/PomodoroCard";
import QuickAddTask from "../components/QuickAddTask";
import TodayTasksCard from "../components/TodayTasksCard";
import WeeklyCard from "../components/WeeklyCard";
import { useAchievements } from "../hooks/useAchievements";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { useTodayItems } from "../hooks/useTodayItems";
import { computeStats } from "../utils/stats";

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { sessions } = useAchievements();
  const today = useTodayItems();

  const stats = useMemo(() => computeStats(sessions), [sessions]);
  const name = user?.displayName?.split(" ")[0] ?? "there";
  const goalSeconds = settings.dailyGoalMinutes * 60;
  const percent = Math.min(100, Math.round((stats.todaySeconds / goalSeconds) * 100));

  return (
    <div className="wf-home">
      <div className="wf-col">
        <div className="o-hero">
          <HeroCard
            name={name}
            count={today.dueCount + today.plans.length}
            streak={stats.currentStreak}
          />
        </div>
        <div className="wf-two o-two">
          <WeeklyCard week={stats.week} />
          <PerformanceCard percent={percent} />
        </div>
        <div className="o-goals">
          <DashboardGoalsCard />
        </div>
        <div className="o-block">
          <BlockListCard />
        </div>
      </div>

      <div className="wf-col">
        <div className="o-tasks">
          <TodayTasksCard />
        </div>
        <div className="o-add">
          <QuickAddTask />
        </div>
        <div className="o-pomo">
          <PomodoroCard />
        </div>
      </div>
    </div>
  );
}
