import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout         from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* Public Pages — loaded eagerly (small, always needed) */
import LoginPage    from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));

/* All other pages — lazy loaded on demand */
const FinanceDashboard     = lazy(() => import("@/pages/FinanceDashboard"));
const TransactionsTab      = lazy(() => import("@/pages/Transactions_tab"));
const FinancePage          = lazy(() => import("@/pages/FinancePage"));
const ImportHubPage        = lazy(() => import("@/pages/ImportHubPage"));
const ManagementPage       = lazy(() => import("@/pages/ManagementPage"));
const PortfolioHubPage     = lazy(() => import("@/pages/PortfolioHubPage"));
const MyLoansPage          = lazy(() => import("@/pages/MyLoansPage"));
const NewLoanPage          = lazy(() => import("@/pages/NewLoanPage"));
const LoanDetailPage       = lazy(() => import("@/pages/LoanDetailPage"));
const ProjectsPage         = lazy(() => import("@/pages/ProjectsPage"));
const NewProjectPage       = lazy(() => import("@/pages/NewProjectPage"));
const ProjectPage          = lazy(() => import("@/pages/ProjectPage"));
const ProfilePage          = lazy(() => import("@/pages/ProfilePage"));
const SettingsPage         = lazy(() => import("@/pages/SettingsPage"));
const NotFoundPage         = lazy(() => import("@/pages/NotFoundPage"));
const SuggestionsPage      = lazy(() => import("@/pages/SuggestionsPage"));
const AdminLogsPage        = lazy(() => import("@/pages/AdminLogsPage"));
const AdminUsersPage       = lazy(() => import("@/pages/AdminUsersPage"));
const UserActivityPage     = lazy(() => import("@/pages/UserActivityPage"));
const BudgetPage           = lazy(() => import("@/pages/BudgetPage"));
const RecurringPage        = lazy(() => import("@/pages/RecurringPage"));
const CategoryInsightsPage = lazy(() => import("@/pages/CategoryInsightsPage"));
const NetWorthPage         = lazy(() => import("@/pages/NetWorthPage"));
const InsurancePage        = lazy(() => import("@/pages/InsurancePage"));
const MortgagePage         = lazy(() => import("@/pages/MortgagePage"));
const GoalsPage            = lazy(() => import("@/pages/GoalsPage"));
const AlertsPage           = lazy(() => import("@/pages/AlertsPage"));
const TaxPage              = lazy(() => import("@/pages/TaxPage"));
const DebtPage             = lazy(() => import("@/pages/DebtPage"));
const ChildSavingsPage     = lazy(() => import("@/pages/ChildSavingsPage"));
const ReportsPage          = lazy(() => import("@/pages/ReportsPage"));
const MaaserPage           = lazy(() => import("@/pages/MaaserPage"));
const FamilyPage           = lazy(() => import("@/pages/FamilyPage"));
const HelpPage             = lazy(() => import("@/pages/HelpPage"));
const MerchantsPage        = lazy(() => import("@/pages/MerchantsPage"));
const BusinessPage         = lazy(() => import("@/pages/BusinessPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  );
}
