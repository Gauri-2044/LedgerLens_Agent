// ============================================================
// LedgerLens AI — Landing Page
// Matching Purple-to-Blue Gradient & Glassmorphism Aesthetics
// No Login Required — Direct Access to App & Dashboard
// ============================================================

import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  FileSpreadsheet,
  ArrowUpRight,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* ─── Top Navigation Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#1e0a45]/90 backdrop-blur-md border-b border-purple-800/30 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white p-1 border border-white/40 shadow-md group-hover:scale-105 transition-transform flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo.jpg" alt="LedgerLens Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                LedgerLens
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-semibold uppercase tracking-wider">
                  AI 2.5
                </span>
              </span>
              <p className="text-[10px] text-purple-300/80 font-medium tracking-wide">
                4-Way Financial Reconciliation
              </p>
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-purple-100/80">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pipeline" className="hover:text-white transition-colors">4-Way Matching</a>
            <a href="#ai-agent" className="hover:text-white transition-colors">Gemini Agent</a>
            <a href="#audit" className="hover:text-white transition-colors">Audit Trail</a>
          </nav>

          {/* Launch App Button (No login required) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
            >
              <span>Launch Dashboard</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section (Matching Screenshot) ────────────────────────── */}
      <section className="hero-gradient text-white pt-20 pb-28 relative">
        <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
          
          {/* Main Title (Exact screenshot style) */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 drop-shadow-sm">
            LedgerLens
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-purple-100/90 max-w-3xl mx-auto font-normal leading-relaxed mb-10">
            Extract, analyze, and understand your financial statements with AI-powered precision. 
            Support for all major issuers, POs, Invoices, Payments, & Goods Receipts.
          </p>

          {/* Floating Glassmorphic Pill Badges (Exact layout matching screenshot) */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
            <div className="glass-pill px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-purple-300" />
              <span>4+ Major Sources</span>
            </div>

            <div className="glass-pill px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2">
              <Zap size={18} className="text-amber-300" />
              <span>Instant Parsing</span>
            </div>

            <div className="glass-pill px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2">
              <Sparkles size={18} className="text-blue-300" />
              <span>Smart Analytics</span>
            </div>
          </div>

          {/* Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-purple-900 font-bold text-base hover:bg-purple-50 shadow-xl shadow-purple-950/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Dashboard</span>
              <ArrowUpRight size={18} />
            </button>

            <button
              onClick={() => navigate('/upload')}
              className="w-full sm:w-auto glass-pill px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet size={18} />
              <span>Upload CSV Files</span>
            </button>
          </div>
        </div>

        {/* Curved White Wave Transition at Bottom of Hero */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none z-20 pointer-events-none">
          <svg
            className="relative block w-full h-12 sm:h-16 md:h-20 text-slate-50"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,60 L1200,120 L0,120 Z"
              fill="currentColor"
            ></path>
          </svg>
        </div>
      </section>

      {/* ─── Feature Highlights Section ────────────────────────────────── */}
      <section id="features" className="py-20 px-4 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <span className="text-xs font-bold text-purple-600 uppercase tracking-widest px-3 py-1 bg-purple-100 rounded-full border border-purple-200">
            Autonomous Financial Engine
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-3">
            Why Finance Teams Trust LedgerLens
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base">
            Replace manual VLOOKUP spreadsheets with autonomous 4-way matching, AI agent investigation, and anti-hallucination guardrails.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Layers size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">4-Way Exact Matching</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Automated 3-way and 4-way matching across POs, Invoices, Payments, and Receipts with sub-second response times.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Cpu size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Gemini 2.5 Agentic AI</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Equipped with 5 tools (`search_vendor`, `calculate_variance`) to autonomously resolve vendor name typos and amount variances.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Anti-Hallucination Guardrails</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Deterministic validator cross-checks entity existence in the database before committing any AI decision.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Lock size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Cryptographic Audit Chain</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Every status update generates an immutable SHA-256 hash-chained log for 100% compliance auditability.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Live Demo Banner / Call to Action ─────────────────────────── */}
      <section id="pipeline" className="py-16 px-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white my-12">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Ready to Reconcile Your Financial Data?
          </h2>
          <p className="text-purple-200 max-w-2xl mx-auto mb-8 text-sm sm:text-base">
            No registration or credit card required. Upload your Purchase Orders, Invoices, Payments, and Receipts to see Gemini AI in action.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/upload')}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 font-bold text-white shadow-xl shadow-purple-500/30 flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Zap size={18} />
              <span>Start Free Reconciliation Run</span>
            </button>

            <button
              onClick={() => navigate('/reconciliation')}
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-semibold text-white flex items-center gap-2 transition-colors"
            >
              <span>View Case Table</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="mt-auto bg-slate-950 text-slate-400 border-t border-slate-800 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="LedgerLens Logo" className="w-8 h-8 object-contain" />
            <span className="text-white font-bold text-base">LedgerLens AI</span>
            <span className="text-xs text-slate-500">© 2026 Razorpay Buildathon</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <button onClick={() => navigate('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <button onClick={() => navigate('/audit')} className="hover:text-white transition-colors">Audit Trail</button>
            <button onClick={() => navigate('/settings')} className="hover:text-white transition-colors">Settings</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
