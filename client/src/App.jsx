import { Routes, Route, Navigate } from "react-router-dom";

/* Layout & Route Protection */
import Layout         from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* Public Pages */
import HomePage     from "@/pages/HomePage";
import LoginPage    from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

/* Core Finance */
import FinanceDashboard        from "@/pages/FinanceDashboard";
import TransactionsTab         from "@/pages/Transactions_tab";
import SmartAnalyticsDashboard from "@/pages/SmartAnalyticsDashboard";
import FinancePage             from "@/pages/FinancePage";
import ImportPage              from "@/pages/ImportPage";
import ManagementPage          from "@/pages/ManagementPage";

/* Investments */
import InvestmentsPage from "@/pages/InvestmentsPage";
import DepositsPage    from "@/pages/DepositsPage";
import FundsPage       from "@/pages/FundsPage";

/* Loans */
import MyLoansPage    from "@/pages/MyLoansPage";
import NewLoanPage    from "@/pages/NewLoanPage";
import LoanDetailPage from "@/pages/LoanDetailPage";

/* Projects */
import ProjectsPage   from "@/pages/ProjectsPage";
import NewProjectPage from "@/pages/NewProjectPage";
import ProjectPage    from "@/pages/ProjectPage";

/* Account */
import ProfilePage  from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";

/* Misc */
import NotFoundPage    from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>

        {/* ── Public ─────────────────────────────────────────── */}
        <Route index           element={<HomePage />}    />
        <Route path="login"    element={<LoginPage />}   />
        <Route path="register" element={<RegisterPage />} />

        {/* ── Protected ──────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>

          {/* Old /dashboard → redirect to the real dashboard */}
          <Route path="dashboard" element={<Navigate to="/finance-dashboard" replace />} />

          {/* Finance */}
          <Route path="finance-dashboard" element={<FinanceDashboard />}       />
          <Route path="portfolio"         element={<TransactionsTab />}         />
          <Route path="smart-analytics"   element={<SmartAnalyticsDashboard />} />
          <Route path="finance"           element={<FinancePage />}             />
          <Route path="import"            element={<ImportPage />}              />
          <Route path="management"        element={<ManagementPage />}          />

          {/* Investments */}
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="deposits"    element={<DepositsPage />}    />
          <Route path="funds"       element={<FundsPage />}       />

          {/* Loans */}
          <Route path="my-loans"       element={<MyLoansPage />}    />
          <Route path="loans/new"      element={<NewLoanPage />}    />
          <Route path="loans/:loanId"  element={<LoanDetailPage />} />

          {/* Projects */}
          <Route path="projects"      element={<ProjectsPage />}   />
          <Route path="projects/new"  element={<NewProjectPage />} />
          <Route path="projects/:id"  element={<ProjectPage />}    />

          {/* Account */}
          <Route path="profile"  element={<ProfilePage />}  />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* ── 404 ────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
