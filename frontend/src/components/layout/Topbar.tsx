// ============================================================
// LedgerLens AI — Topbar Component
// ============================================================
import { useState } from 'react';
import { Menu, Search, Bell, ChevronDown, User, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
  pageTitle: string;
  onMobileMenuToggle: () => void;
}

export default function Topbar({ pageTitle, onMobileMenuToggle }: TopbarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const navigate = useNavigate();

  const notifications = [
    { id: 1, message: 'RC-1042 needs your review', time: '2m ago', unread: true },
    { id: 2, message: 'Reconciliation batch completed', time: '15m ago', unread: true },
    { id: 3, message: 'RC-1040 marked as unresolved', time: '1h ago', unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-0 h-16 bg-white border-b border-slate-200 z-20 flex items-center px-4 gap-4">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden text-slate-500 hover:text-slate-700"
        onClick={onMobileMenuToggle}
      >
        <Menu size={20} />
      </button>

      {/* Page title — left */}
      <div className="font-semibold text-slate-800 text-sm hidden sm:block">{pageTitle}</div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-56 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search cases, vendors..."
          className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none flex-1 min-w-0"
          onFocus={() => {}}
        />
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {showNotif && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowNotif(false)} />
            <div className="absolute right-0 top-11 z-20 w-80 bg-white border border-slate-200 rounded-xl shadow-card-lg py-2 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Notifications</span>
                <span className="text-[10px] text-primary-600 cursor-pointer hover:underline">Mark all read</span>
              </div>
              {notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${n.unread ? 'bg-primary-50/30' : ''}`}>
                  <p className={`text-xs ${n.unread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors"
        >
          <div className="w-7 h-7 bg-gradient-primary rounded-full flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">FC</span>
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">Finance Controller</p>
            <p className="text-[10px] text-slate-500 leading-tight">Admin</p>
          </div>
          <ChevronDown size={13} className="text-slate-400 hidden sm:block" />
        </button>

        {showProfile && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} />
            <div className="absolute right-0 top-11 z-20 w-52 bg-white border border-slate-200 rounded-xl shadow-card-lg py-1.5 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800">Finance Controller</p>
                <p className="text-[10px] text-slate-500">fc@acmetechnologies.in</p>
              </div>
              <button
                onClick={() => { navigate('/settings'); setShowProfile(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Settings size={13} />
                Settings
              </button>
              <button className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
