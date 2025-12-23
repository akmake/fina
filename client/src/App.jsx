import { Routes, Route } from "react-router-dom";

/* Layout & Route Protection */
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* Public Pages */
import HomePage        from "@/pages/HomePage";
import LoginPage       from "@/pages/LoginPage";
import RegisterPage    from "@/pages/RegisterPage";

/* Protected Pages */
import DashboardPage      from "@/pages/DashboardPage";
import FinancePage        from "@/pages/FinancePage";
import TzitzitFormPage    from "@/pages/TzitzitFormPage";
import DataEntryPage      from "@/pages/DataEntryPage";
import ImportPage         from "@/pages/ImportPage";
import ManagementPage     from "@/pages/ManagementPage";
import ProjectsPage       from "@/pages/ProjectsPage";
import ProjectPage        from "@/pages/ProjectPage";
import NewProjectPage     from "@/pages/NewProjectPage";
import TransactionsTab    from "@/pages/Transactions_tab";
import FinanceDashboard   from "@/pages/FinanceDashboard";
import InvestmentsPage    from "@/pages/InvestmentsPage";
import DepositsPage       from '@/pages/DepositsPage';
import FundsPage          from '@/pages/FundsPage'; // ייבוא העמוד החדש
import MyLoansPage from './pages/MyLoansPage';
import NewLoanPage from './pages/NewLoanPage';
import LoanDetailPage from './pages/LoanDetailPage';


/* Fallback */
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* -------- Public Routes -------- */}
        <Route index           element={<HomePage />}    />
        <Route path="login"    element={<LoginPage />}   />
        <Route path="register" element={<RegisterPage />} />

        {/* -------- Protected Routes -------- */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard"          element={<DashboardPage />}      />
          <Route path="finance"            element={<FinancePage />}        />
          <Route path="tzitzit"            element={<TzitzitFormPage />}    />
          <Route path="data-entry"         element={<DataEntryPage />}      />
          <Route path="management"         element={<ManagementPage />}     />
          <Route path="import"             element={<ImportPage />}         />
          <Route path="portfolio"          element={<TransactionsTab />}    />
          <Route path="investments"        element={<InvestmentsPage />}    />
          <Route path="finance-dashboard"  element={<FinanceDashboard />}   />
          <Route path="/deposits"          element={<DepositsPage/>} />
          <Route path="/funds"             element={<FundsPage />} /> 
          <Route path="/my-loans"          element={<MyLoansPage />} />
          <Route path="/loans/new"         element={<NewLoanPage />} />
          <Route path="/loans/:loanId"     element={<LoanDetailPage />} />

          {/* ----- Project Routes ----- */}
          <Route path="projects"       element={<ProjectsPage />}      />
          <Route path="projects/new"   element={<NewProjectPage />}    />
          <Route path="projects/:id"   element={<ProjectPage />}       />
        </Route>

        {/* -------- 404 -------- */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
