import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";

// Pages are code-split so each route loads its own chunk on demand.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceEditor = lazy(() => import("./pages/InvoiceEditor"));
const InvoiceView = lazy(() => import("./pages/InvoiceView"));
const Bills = lazy(() => import("./pages/Bills"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Estimator = lazy(() => import("./pages/Estimator"));
const EstimateEditor = lazy(() => import("./pages/EstimateEditor"));
const EstimateView = lazy(() => import("./pages/EstimateView"));
const Projects = lazy(() => import("./pages/Projects"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceEditor />} />
          <Route path="invoices/:id" element={<InvoiceView />} />
          <Route path="invoices/:id/edit" element={<InvoiceEditor />} />
          <Route path="bills" element={<Bills />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="estimator" element={<Estimator />} />
          <Route path="estimator/new" element={<EstimateEditor />} />
          <Route path="estimator/:id" element={<EstimateView />} />
          <Route path="estimator/:id/edit" element={<EstimateEditor />} />
          <Route path="projects" element={<Projects />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
