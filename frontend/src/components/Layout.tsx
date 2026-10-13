import { Outlet } from "react-router-dom";
import AchievementsProvider from "../hooks/AchievementsProvider";
import FocusProvider from "../hooks/FocusProvider";
import MusicProvider from "../hooks/MusicProvider";
import SettingsProvider from "../hooks/SettingsProvider";
import { useFocus } from "../hooks/useFocus";
import AppBackground from "./AppBackground";
import BottomNav from "./BottomNav";
import { LogoMark } from "./Icon";
import MiniTimer from "./MiniTimer";
import MusicDock from "./MusicDock";
import Sidebar from "./Sidebar";
import StrictGuard from "./StrictGuard";
import StrictOverlay from "./StrictOverlay";
import TopBar from "./TopBar";
import { useSyncProfile } from "../hooks/useSocial";

function Shell() {
  const { strictActive } = useFocus();

  return (
    <>
      <AppBackground />
      <div className={`wf-window ${strictActive ? "locked" : ""}`}>
        {!strictActive && (
          <div className="wf-logo">
            <LogoMark />
          </div>
        )}
        {!strictActive && <TopBar />}
        {!strictActive && <Sidebar />}
        <main className="wf-main app-main">
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
  useSyncProfile();