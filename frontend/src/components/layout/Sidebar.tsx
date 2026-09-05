// ============================================================
// LedgerLens AI — Sidebar Component
// ============================================================
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Search,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  Upload,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Circle,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to: string;
}

const mainNav: NavItem[] = [
  { label: 'Overview',        icon: <LayoutDashboard size={18} />, to: '/dashboard' },
  { label: 'Reconciliation',  icon: <ArrowLeftRight  size={18} />, to: '/reconciliation' },
  { label: 'Investigations',  icon: <Search          size={18} />, to: '/investigation/RC-1042' },
  { label: 'Exceptions',      icon: <AlertTriangle   size={18} />, to: '/exceptions' },
  { label: 'Audit Trail',     icon: <ClipboardList   size={18} />, to: '/audit' },
  { label: 'Analytics',       icon: <BarChart3       size={18} />, to: '/analytics' },
];

const dataNav: NavItem[] = [
  { label: 'Uploads',  icon: <Upload   size={18} />, to: '/upload' },
  { label: 'Sources',  icon: <Database size={18} />, to: '/sources' },
];

const systemNav: NavItem[] = [
  { label: 'Settings', icon: <Settings size={18} />, to: '/settings' },
];

function NavGroup({
  items,
  collapsed,
  onClick,
}: {
  items: NavItem[];
  collapsed: boolean;
  onClick?: () => void;
}) {
  const location = useLocation();
  return (
    <div className="flex flex-col gap-0.5">
      {items.map(item => {
        const isActive =
          item.to === '/dashboard'
            ? location.pathname === '/dashboard'
            : location.pathname.startsWith(item.to.replace('/RC-1042', ''));
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={`sidebar-link ${isActive ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

function SidebarContent({
  collapsed,
  onToggle,
  onItemClick,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200 shrink-0">
        {!collapsed && (
          <NavLink to="/" className="flex items-center gap-2.5 group">
            {/* Logo Mark */}
            <div className="w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform overflow-hidden border border-slate-200 shrink-0">
              <img src="/logo.jpg" alt="LedgerLens Logo" className="w-full h-full object-contain rounded-md" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1">
                LedgerLens
              </div>
              <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-widest leading-tight">AI 2.5</div>
            </div>
          </NavLink>
        )}
        {collapsed && (
          <NavLink to="/" className="mx-auto w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm overflow-hidden border border-slate-200 shrink-0">
            <img src="/logo.jpg" alt="LedgerLens Logo" className="w-full h-full object-contain rounded-md" />
          </NavLink>
        )}
        <button
          onClick={onToggle}
          className="hidden lg:flex w-6 h-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        {!collapsed && (
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Navigation
          </p>
        )}
        <NavGroup items={mainNav} collapsed={collapsed} onClick={onItemClick} />

        <div className="my-4 border-t border-slate-200" />

        {!collapsed && (
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Data
          </p>
        )}
        <NavGroup items={dataNav} collapsed={collapsed} onClick={onItemClick} />

        <div className="my-4 border-t border-slate-200" />

        {!collapsed && (
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            System
          </p>
        )}
        <NavGroup items={systemNav} collapsed={collapsed} onClick={onItemClick} />
      </div>

      {/* AI Status */}
      <div className="border-t border-slate-200 px-3 py-3 shrink-0">
        {collapsed ? (
          <div className="flex justify-center" title="AI Engine: Operational">
            <Circle size={8} className="fill-emerald-500 text-emerald-500" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <Cpu size={14} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800">AI Engine</p>
              <p className="text-[10px] text-emerald-600">Operational</p>
            </div>
            <Circle size={7} className="fill-emerald-500 text-emerald-500 animate-pulse-soft shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block fixed left-0 top-0 h-full z-30 transition-all duration-250 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-50 w-60 transition-transform duration-250 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent collapsed={false} onToggle={onMobileClose} onItemClick={onMobileClose} />
      </aside>
    </>
  );
}
