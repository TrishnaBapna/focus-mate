import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import TimeBackground from "./components/TimeBackground";
import Dashboard from "./pages/Dashboard";
import Exams from "./pages/Exams";
import Focus from "./pages/Focus";
import Login from "./pages/Login";
import NoteEditor from "./pages/NoteEditor";
import Notes from "./pages/Notes";
import Placeholder from "./pages/Placeholder";
import Planner from "./pages/Planner";
import Settings from "./pages/Settings";
import Subjects from "./pages/Subjects";
import Tasks from "./pages/Tasks";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <>
            <TimeBackground />
            <Login />
          </>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:id" element={<NoteEditor />} />
          <Route path="/analytics" element={<Placeholder title="Analytics" />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
