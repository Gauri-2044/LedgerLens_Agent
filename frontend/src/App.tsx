// ============================================================
// LedgerLens AI — App Router
// Includes Landing Page & No-Login Access
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { ToastProvider } from './context/ToastContext';

// Pages
import Landing        from './pages/Landing';
import Dashboard      from './pages/Dashboard';
import Reconciliation from './pages/Reconciliation';
import Investigation  from './pages/Investigation';
import Upload         from './pages/Upload';
import Exceptions     from './pages/Exceptions';
import AuditTrail     from './pages/AuditTrail';
import Analytics      from './pages/Analytics';
import Settings       from './pages/Settings';
import Sources        from './pages/Sources';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing Page (Full Width, Glowing Purple/Blue Theme) */}
          <Route path="/"        element={<Landing />} />
          <Route path="/landing" element={<Landing />} />

          {/* Application Shell Routes (No Login Required) */}
          <Route element={<AppShell />}>
            <Route path="/dashboard"            element={<Dashboard />} />
            <Route path="/reconciliation"       element={<Reconciliation />} />
            <Route path="/investigation/:caseId" element={<Investigation />} />
            <Route path="/exceptions"           element={<Exceptions />} />
            <Route path="/audit"               element={<AuditTrail />} />
            <Route path="/analytics"            element={<Analytics />} />
            <Route path="/upload"               element={<Upload />} />
            <Route path="/sources"              element={<Sources />} />
            <Route path="/settings"             element={<Settings />} />
            {/* Fallback */}
            <Route path="*"                    element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
