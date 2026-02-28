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
import DiscountImportPage      from './pages/DiscountImportPage';
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
import SuggestionsPage from "@/pages/SuggestionsPage";
import AdminLogsPage   from "@/pages/AdminLogsPage";
import UserActivityPage from "@/pages/UserActivityPage";

/* New Features */
import BudgetPage      from "@/pages/BudgetPage";
import RecurringPage   from "@/pages/RecurringPage";
import PensionPage     from "@/pages/PensionPage";
import NetWorthPage    from "@/pages/NetWorthPage";
import ExcelImportPage from "@/pages/ExcelImportPage";

/* Extended Features */
import InsurancePage       from "@/pages/InsurancePage";
import MortgagePage        from "@/pages/MortgagePage";
import GoalsPage           from "@/pages/GoalsPage";
import AlertsPage          from "@/pages/AlertsPage";
import TaxPage             from "@/pages/TaxPage";
import RealEstatePage      from "@/pages/RealEstatePage";
import DebtPage            from "@/pages/DebtPage";
import ChildSavingsPage    from "@/pages/ChildSavingsPage";
import ForeignCurrencyPage from "@/pages/ForeignCurrencyPage";
import ReportsPage         from "@/pages/ReportsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>

        {/* ── Public ─────────────────────────────────────────── */}
        <Route index           element={<Navigate to="/finance-dashboard" replace />} />
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
          <Route path="budget"            element={<BudgetPage />}              />
          <Route path="recurring"         element={<RecurringPage />}           />
          <Route path="net-worth"         element={<NetWorthPage />}            />
          <Route path="import"            element={<ImportPage />}              />
          <Route path="import/excel"      element={<ExcelImportPage />}         />
          <Route path="management"        element={<ManagementPage />}          />
          <Route path="/discount-import" element={<DiscountImportPage />} />

          {/* Investments */}
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="deposits"    element={<DepositsPage />}    />
          <Route path="funds"       element={<FundsPage />}       />
          <Route path="pension"     element={<PensionPage />}     />

          {/* Loans */}
          <Route path="my-loans"       element={<MyLoansPage />}    />
          <Route path="loans/new"      element={<NewLoanPage />}    />
          <Route path="loans/:loanId"  element={<LoanDetailPage />} />

          {/* Projects */}
          <Route path="projects"      element={<ProjectsPage />}   />
          <Route path="projects/new"  element={<NewProjectPage />} />
          <Route path="projects/:id"  element={<ProjectPage />}    />

          {/* Account */}
          <Route path="profile"     element={<ProfilePage />}     />
          <Route path="settings"    element={<SettingsPage />}    />
          <Route path="suggestions" element={<SuggestionsPage />} />

          {/* Extended Features */}
          <Route path="insurance"        element={<InsurancePage />}       />
          <Route path="mortgage"         element={<MortgagePage />}        />
          <Route path="goals"            element={<GoalsPage />}           />
          <Route path="alerts"           element={<AlertsPage />}          />
          <Route path="tax"              element={<TaxPage />}             />
          <Route path="real-estate"      element={<RealEstatePage />}      />
          <Route path="debts"            element={<DebtPage />}            />
          <Route path="child-savings"    element={<ChildSavingsPage />}    />
          <Route path="foreign-currency" element={<ForeignCurrencyPage />} />
          <Route path="reports"          element={<ReportsPage />}         />

          {/* Admin */}
          <Route path="admin/logs" element={<AdminLogsPage />} />
          <Route path="admin/user-activity" element={<UserActivityPage />} />
        </Route>

        {/* ── 404 ────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
