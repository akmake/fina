// This route now redirects to the real finance dashboard.
// The Navigate is also declared in App.jsx, but this file is kept
// as a safety net in case it is imported elsewhere.
import { Navigate } from "react-router-dom";
export default function DashboardPage() {
  return <Navigate to="/finance-dashboard" replace />;
}
