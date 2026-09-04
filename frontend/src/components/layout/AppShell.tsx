// ============================================================
// LedgerLens AI — App Shell Layout
// ============================================================
import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Toast from '../ui/Toast';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/reconciliation': 'Reconciliation',
  '/exceptions': 'Exception Center',
  '/audit': 'Audit Trail',
  '/analytics': 'Analytics',
  '/upload': 'Upload & Ingestion',
  '/sources': 'Data Sources',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/investigation')) return 'Investigation';
  return PAGE_TITLES[pathname] ?? 'LedgerLens AI';
}

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Auto-collapse on tablet
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const sidebarWidth = sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56';

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content area */}
      <div className={`flex flex-col min-h-screen transition-all duration-250 ${sidebarWidth}`}>
        <Topbar
          pageTitle={getPageTitle(location.pathname)}
          onMobileMenuToggle={() => setMobileOpen(o => !o)}
        />

        <main className="flex-1 mt-16 page-enter">
          <Outlet />
        </main>
      </div>

      <Toast />
    </div>
  );
}
