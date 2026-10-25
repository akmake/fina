import { Routes, Route, Navigate } from "react-router-dom";

import Layout         from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* Public Pages — loaded eagerly (small, always needed) */
import LoginPage    from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

import PrivacyPage from "@/pages/PrivacyPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import FinanceDashboard from "@/pages/FinanceDashboard";
import TransactionsTab from "@/pages/Transactions_tab";
import FinancePage from "@/pages/FinancePage";
import ImportHubPage from "@/pages/ImportHubPage";
import ManagementPage from "@/pages/ManagementPage";
import PortfolioHubPage from "@/pages/PortfolioHubPage";
import MyLoansPage from "@/pages/MyLoansPage";
import NewLoanPage from "@/pages/NewLoanPage";
import LoanDetailPage from "@/pages/LoanDetailPage";
import ProjectsPage from "@/pages/ProjectsPage";
import NewProjectPage from "@/pages/NewProjectPage";
import ProjectPage from "@/pages/ProjectPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import SuggestionsPage from "@/pages/SuggestionsPage";
import AdminLogsPage from "@/pages/AdminLogsPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import UserActivityPage from "@/pages/UserActivityPage";
import BudgetPage from "@/pages/BudgetPage";
import RecurringPage from "@/pages/RecurringPage";
import CategoryInsightsPage from "@/pages/CategoryInsightsPage";
import NetWorthPage from "@/pages/NetWorthPage";
import InsurancePage from "@/pages/InsurancePage";
import MortgagePage from "@/pages/MortgagePage";
import GoalsPage from "@/pages/GoalsPage";
import AlertsPage from "@/pages/AlertsPage";
import TaxPage from "@/pages/TaxPage";
import DebtPage from "@/pages/DebtPage";
import ChildSavingsPage from "@/pages/ChildSavingsPage";
import ReportsPage from "@/pages/ReportsPage";
import MaaserPage from "@/pages/MaaserPage";
import FamilyPage from "@/pages/FamilyPage";
import HelpPage from "@/pages/HelpPage";
import MerchantsPage from "@/pages/MerchantsPage";
import BusinessPage from "@/pages/BusinessPage";

export default function App() {
  return (
      <Routes>
        <Route path="/" element={<Layout />}>

          {/* ── Public ─────────────────────────────────────────── */}
          <Route index           element={<Navigate to="/finance-dashboard" replace />} />
          <Route path="login"    element={<LoginPage />}    />
          <Route path="register" element={<RegisterPage />} />
          <Route path="privacy"  element={<PrivacyPage />}  />
          <Route path="verify-email" element={<VerifyEmailPage />} />

          {/* ── Protected ──────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>

            <Route path="dashboard" element={<Navigate to="/finance-dashboard" replace />} />

            {/* Finance */}
            <Route path="finance-dashboard" element={<FinanceDashboard />}        />
            <Route path="portfolio"         element={<TransactionsTab />}          />
            {/* דשבורד יחיד — smart-analytics מתמזג ל-finance-dashboard (§6.1) */}
            <Route path="smart-analytics"   element={<Navigate to="/finance-dashboard" replace />} />
            <Route path="finance"           element={<FinancePage />}              />
            <Route path="budget"            element={<BudgetPage />}               />
            <Route path="categories"        element={<CategoryInsightsPage />}     />
            <Route path="recurring"         element={<RecurringPage />}            />
            <Route path="merchants"         element={<MerchantsPage />}            />
            <Route path="business"          element={<BusinessPage />}             />
            <Route path="net-worth"         element={<NetWorthPage />}             />
            {/* Import/Connections — אשף אחד עם טאבים (ImportHubPage) */}
            <Route path="connections"        element={<ImportHubPage />} />
            <Route path="import"             element={<ImportHubPage />} />
            <Route path="import/connections" element={<ImportHubPage />} />
            <Route path="import/auto"        element={<ImportHubPage />} />
            <Route path="import/excel"       element={<ImportHubPage />} />
            <Route path="import/sqlite"      element={<ImportHubPage />} />
            <Route path="import/cal"         element={<ImportHubPage />} />
            <Route path="import/max"         element={<ImportHubPage />} />
            <Route path="/discount-import"   element={<ImportHubPage />} />
            <Route path="management"         element={<ManagementPage />} />

            {/* תיק נכסים — עמוד אחד עם טאבים (PortfolioHubPage) */}
            <Route path="assets"      element={<PortfolioHubPage />} />
            <Route path="investments" element={<PortfolioHubPage />} />
            <Route path="deposits"    element={<PortfolioHubPage />} />
            <Route path="funds"       element={<PortfolioHubPage />} />
            <Route path="pension"     element={<PortfolioHubPage />} />

            {/* Loans */}
            <Route path="my-loans"       element={<MyLoansPage />}    />
            <Route path="loans/new"      element={<NewLoanPage />}    />
            <Route path="loans/:loanId"  element={<LoanDetailPage />} />

            {/* Projects */}
            <Route path="projects"      element={<ProjectsPage />}   />
            <Route path="projects/new"  element={<NewProjectPage />} />
            <Route path="projects/:id"  element={<ProjectPage />}    />

            {/* Family */}
            <Route path="family" element={<FamilyPage />} />
            <Route path="help"   element={<HelpPage />} />

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
            <Route path="real-estate"      element={<PortfolioHubPage />}    />
            <Route path="debts"            element={<DebtPage />}            />
            <Route path="child-savings"    element={<ChildSavingsPage />}    />
            <Route path="foreign-currency" element={<PortfolioHubPage />} />
            <Route path="reports"          element={<ReportsPage />}         />
            <Route path="maaser"           element={<MaaserPage />}          />


            {/* Admin */}
            <Route path="admin/logs"          element={<AdminLogsPage />}     />
            <Route path="admin/users"         element={<AdminUsersPage />}    />
            <Route path="admin/user-activity" element={<UserActivityPage />}  />
          </Route>

          {/* ── 404 ────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
  );
}
