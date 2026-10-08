import { Outlet } from "react-router-dom";
import AchievementsProvider from "../hooks/AchievementsProvider";
import FocusProvider from "../hooks/FocusProvider";
import SettingsProvider from "../hooks/SettingsProvider";
import AppBackground from "./AppBackground";
import BottomNav from "./BottomNav";
import MiniTimer from "./MiniTimer";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <SettingsProvider>
      <FocusProvider>
        <AchievementsProvider>
          <AppBackground />
          <div className="app-shell">
            <Sidebar />
            <main className="app-main">
              <Outlet />
            </main>
          </div>
          <BottomNav />
          <MiniTimer />
        </AchievementsProvider>
      </FocusProvider>
    </SettingsProvider>
  );
}
