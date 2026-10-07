import { Outlet } from "react-router-dom";
import FocusProvider from "../hooks/FocusProvider";
import AppBackground from "./AppBackground";
import MiniTimer from "./MiniTimer";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
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
  );
}
