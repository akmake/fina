import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout         from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* Public Pages — loaded eagerly (small, always needed) */
import LoginPage    from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));

/* All other pages — lazy loaded on demand */
const HomePage             = lazy(() => import("@/pages/HomePage"));
const FinanceDashboard     = lazy(() => import("@/pages/FinanceDashboard"));
const TransactionsTab      = lazy(() => import("@/pages/Transactions_tab"));
const SmartAnalyticsDashboard = lazy(() => import("@/pages/SmartAnalyticsDashboard"));
const FinancePage          = lazy(() => import("@/pages/FinancePage"));
const ImportPage           = lazy(() => import("@/pages/ImportPage"));
const ManagementPage       = lazy(() => import("@/pages/ManagementPage"));
const DiscountImportPage   = lazy(() => import("@/pages/DiscountImportPage"));
const InvestmentsPage      = lazy(() => import("@/pages/InvestmentsPage"));
const DepositsPage         = lazy(() => import("@/pages/DepositsPage"));
const FundsPage            = lazy(() => import("@/pages/FundsPage"));
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
const UserActivityPage     = lazy(() => import("@/pages/UserActivityPage"));
const BudgetPage           = lazy(() => import("@/pages/BudgetPage"));
const RecurringPage        = lazy(() => import("@/pages/RecurringPage"));
const CategoryInsightsPage = lazy(() => import("@/pages/CategoryInsightsPage"));
const PensionPage          = lazy(() => import("@/pages/PensionPage"));
const NetWorthPage         = lazy(() => import("@/pages/NetWorthPage"));
const ExcelImportPage      = lazy(() => import("@/pages/ExcelImportPage"));
const InsurancePage        = lazy(() => import("@/pages/InsurancePage"));
const MortgagePage         = lazy(() => import("@/pages/MortgagePage"));
const GoalsPage            = lazy(() => import("@/pages/GoalsPage"));
const AlertsPage           = lazy(() => import("@/pages/AlertsPage"));
const TaxPage              = lazy(() => import("@/pages/TaxPage"));
const RealEstatePage       = lazy(() => import("@/pages/RealEstatePage"));
const DebtPage             = lazy(() => import("@/pages/DebtPage"));
const ChildSavingsPage     = lazy(() => import("@/pages/ChildSavingsPage"));
const ForeignCurrencyPage  = lazy(() => import("@/pages/ForeignCurrencyPage"));
const ReportsPage          = lazy(() => import("@/pages/ReportsPage"));
const PergolaPlannerPage   = lazy(() => import("@/pages/PergolaPlannerPage"));
const ElectricalCADPage    = lazy(() => import("@/pages/ElectricalCADPage"));
const AutoImportPage       = lazy(() => import("@/pages/AutoImportPage"));
const CalDirectImportPage  = lazy(() => import("@/pages/CalDirectImportPage"));

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

          {/* ── Protected ──────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>

            <Route path="dashboard" element={<Navigate to="/finance-dashboard" replace />} />

            {/* Finance */}
            <Route path="finance-dashboard" element={<FinanceDashboard />}        />
            <Route path="portfolio"         element={<TransactionsTab />}          />
            <Route path="smart-analytics"   element={<SmartAnalyticsDashboard />}  />
            <Route path="finance"           element={<FinancePage />}              />
            <Route path="budget"            element={<BudgetPage />}               />
            <Route path="categories"        element={<CategoryInsightsPage />}     />
            <Route path="recurring"         element={<RecurringPage />}            />
            <Route path="net-worth"         element={<NetWorthPage />}             />
            <Route path="import"            element={<ImportPage />}               />
            <Route path="import/excel"      element={<ExcelImportPage />}          />
            <Route path="import/auto"       element={<AutoImportPage />}           />
            <Route path="import/cal"        element={<CalDirectImportPage />}      />
            <Route path="management"        element={<ManagementPage />}           />
            <Route path="/discount-import"  element={<DiscountImportPage />}       />

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

            {/* Tools */}
            <Route path="pergola-planner"  element={<PergolaPlannerPage />}  />
            <Route path="electrical"       element={<ElectricalCADPage />}   />
            <Route path="electrical/:projectId" element={<ElectricalCADPage />} />

            {/* Admin */}
            <Route path="admin/logs"          element={<AdminLogsPage />}     />
            <Route path="admin/user-activity" element={<UserActivityPage />}  />
          </Route>

          {/* ── 404 ────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
