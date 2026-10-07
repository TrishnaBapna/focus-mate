import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Focus from "./pages/Focus";
import Login from "./pages/Login";
import NoteEditor from "./pages/NoteEditor";
import Notes from "./pages/Notes";
import Subjects from "./pages/Subjects";
import Placeholder from "./pages/Placeholder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:id" element={<NoteEditor />} />
          <Route path="/planner" element={<Placeholder title="Planner" />} />
          <Route path="/analytics" element={<Placeholder title="Analytics" />} />
        </Route>
      </Route>
    </Routes>
  );
}
