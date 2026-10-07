import { Outlet } from "react-router-dom";
import FocusProvider from "../hooks/FocusProvider";
import SettingsProvider from "../hooks/SettingsProvider";
import AppBackground from "./AppBackground";
import MiniTimer from "./MiniTimer";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <SettingsProvider>
      <FocusProvider>
        <AppBackground />
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">
            <Outlet />
          </main>
        </div>
        <MiniTimer />
      </FocusProvider>
    </SettingsProvider>
  );
}
