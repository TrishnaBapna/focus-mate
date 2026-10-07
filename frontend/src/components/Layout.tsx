import { Outlet } from "react-router-dom";
import FocusProvider from "../hooks/FocusProvider";
import MiniTimer from "./MiniTimer";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <FocusProvider>
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
