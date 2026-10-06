import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Placeholder from "./pages/Placeholder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/planner" element={<Placeholder title="Planner" />} />
          <Route path="/focus" element={<Placeholder title="Focus" />} />
          <Route path="/notes" element={<Placeholder title="Notes" />} />
          <Route path="/analytics" element={<Placeholder title="Analytics" />} />
        </Route>
      </Route>
    </Routes>
  );
}
