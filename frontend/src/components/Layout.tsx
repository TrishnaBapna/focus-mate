import { Outlet } from "react-router-dom";
import AchievementsProvider from "../hooks/AchievementsProvider";
import FocusProvider from "../hooks/FocusProvider";
import MusicProvider from "../hooks/MusicProvider";
import SettingsProvider from "../hooks/SettingsProvider";
import { useFocus } from "../hooks/useFocus";
import AppBackground from "./AppBackground";
import BottomNav from "./BottomNav";
import MiniTimer from "./MiniTimer";
import MusicDock from "./MusicDock";
import Sidebar from "./Sidebar";
import StrictGuard from "./StrictGuard";
import StrictOverlay from "./StrictOverlay";
import TopBar from "./TopBar";

function Shell() {
  const { strictActive } = useFocus();

  return (
    <>
      <AppBackground />
      {!strictActive && <TopBar />}
      <div className={`app-shell ${strictActive ? "locked" : ""}`}>
        {!strictActive && <Sidebar />}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      {!strictActive && <BottomNav />}
      <MiniTimer />
      <MusicDock />
      <StrictGuard />
      <StrictOverlay />
    </>
  );
}

export default function Layout() {
  return (
    <SettingsProvider>
      <FocusProvider>
        <AchievementsProvider>
          <MusicProvider>
            <Shell />
          </MusicProvider>
        </AchievementsProvider>
      </FocusProvider>
    </SettingsProvider>
  );
}
