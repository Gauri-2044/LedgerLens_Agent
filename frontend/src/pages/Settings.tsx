// ============================================================
// LedgerLens AI — Settings Page
// ============================================================
import { useState, useEffect } from 'react';
import {
  Building2, Settings as SettingsIcon, Target, Database,
  Bot, Bell, Save, Check, ChevronRight, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { getSettings, updateSettings } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { SettingsConfig } from '../types';

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ value, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`transition-all duration-200 ${value ? 'text-primary-600' : 'text-slate-300'}`}
      >
        {value
          ? <ToggleRight size={32} strokeWidth={1.5} />
          : <ToggleLeft  size={32} strokeWidth={1.5} />
        }
      </button>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

function SliderField({ label, description, value, min = 0, max = 100, step = 1, unit = '%', onChange }: SliderFieldProps) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-1 bg-primary-50 border border-primary-200 rounded-lg px-3 py-1">
          <span className="text-sm font-bold text-primary-700">{value}</span>
          <span className="text-xs text-primary-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary-600"
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function TextField({ label, description, value, onChange, placeholder }: {
  label: string; description?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input text-xs py-1.5 w-48 shrink-0"
        />
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: 'organization',    label: 'Organization',          icon: <Building2 size={16} /> },
  { id: 'reconciliation',  label: 'Reconciliation Rules',  icon: <SettingsIcon size={16} /> },
  { id: 'confidence',      label: 'Confidence Thresholds', icon: <Target size={16} /> },
  { id: 'dataSources',     label: 'Data Sources',          icon: <Database size={16} /> },
  { id: 'ai',              label: 'AI Configuration',      icon: <Bot size={16} /> },
  { id: 'notifications',   label: 'Notifications',         icon: <Bell size={16} /> },
];

export default function Settings() {
  const { addToast } = useToast();
  const [config, setConfig] = useState<SettingsConfig | null>(null);
  const [activeSection, setActiveSection] = useState('organization');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(r => { if (r.success) setConfig(r.data); });
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const res = await updateSettings(config);
      if (res.success) {
        addToast({ type: 'success', title: 'Settings Saved', message: 'Configuration updated successfully.' });
      }
    } catch {
      addToast({ type: 'error', title: 'Save Failed', message: 'Could not save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SettingsConfig>(section: K, key: keyof SettingsConfig[K], value: unknown) => {
    if (!config) return;
    setConfig({ ...config, [section]: { ...config[section], [key]: value } });
  };

  if (!config) {
    return (
      <div className="page-container">
        <div className="flex gap-6">
          <div className="card w-56 p-4 h-64 animate-pulse bg-slate-50 shrink-0" />
          <div className="card flex-1 p-6 h-64 animate-pulse bg-slate-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-[1000px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure LedgerLens AI reconciliation parameters.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <><Check size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save Changes</>}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="card w-52 p-2 h-fit shrink-0 hidden sm:block">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                activeSection === s.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {s.icon}
                {s.label}
              </div>
              {activeSection === s.id && <ChevronRight size={12} />}
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="card flex-1 p-5 min-w-0">
          {activeSection === 'organization' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">Organization</h2>
              <p className="text-xs text-slate-500 mb-4">Basic organization details.</p>
              <TextField label="Organization Name" value={config.organization.name} onChange={v => update('organization', 'name', v)} />
              <TextField label="GSTIN" value={config.organization.gstin} onChange={v => update('organization', 'gstin', v)} placeholder="29AABCT1332L1ZV" />
              <TextField label="Financial Year" value={config.organization.financialYear} onChange={v => update('organization', 'financialYear', v)} />
              <TextField label="Default Currency" value={config.organization.currency} onChange={v => update('organization', 'currency', v)} />
              <TextField label="Timezone" value={config.organization.timezone} onChange={v => update('organization', 'timezone', v)} />
            </div>
          )}

          {activeSection === 'reconciliation' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">Reconciliation Rules</h2>
              <p className="text-xs text-slate-500 mb-4">Control matching thresholds and behavior.</p>
              <SliderField
                label="Automatic Match Threshold"
                description="Cases above this score are auto-matched without AI"
                value={config.reconciliation.automaticMatchThreshold}
                onChange={v => update('reconciliation', 'automaticMatchThreshold', v)}
              />
              <SliderField
                label="AI Investigation Threshold"
                description="Cases below this score are sent to AI for investigation"
                value={config.reconciliation.aiInvestigationThreshold}
                onChange={v => update('reconciliation', 'aiInvestigationThreshold', v)}
              />
              <SliderField
                label="Amount Tolerance"
                description="Max allowed variance in INR before flagging as exception"
                value={config.reconciliation.amountTolerance}
                min={0} max={1000} step={5} unit="₹"
                onChange={v => update('reconciliation', 'amountTolerance', v)}
              />
              <SliderField
                label="Vendor Similarity Threshold"
                description="Min score for vendor name fuzzy match"
                value={config.reconciliation.vendorSimilarityThreshold}
                onChange={v => update('reconciliation', 'vendorSimilarityThreshold', v)}
              />
              <Toggle
                label="Enable Fuzzy Matching"
                description="Use fuzzy string matching for vendor names"
                value={config.reconciliation.enableFuzzyMatching}
                onChange={v => update('reconciliation', 'enableFuzzyMatching', v)}
              />
              <Toggle
                label="Enable GST Validation"
                description="Cross-validate GSTIN from GSTR-2B records"
                value={config.reconciliation.enableGSTValidation}
                onChange={v => update('reconciliation', 'enableGSTValidation', v)}
              />
            </div>
          )}

          {activeSection === 'confidence' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">Confidence Thresholds</h2>
              <p className="text-xs text-slate-500 mb-4">Define what constitutes high, medium, and low confidence.</p>
              <SliderField label="High Confidence" description="Cases ≥ this value are auto-approved" value={config.confidence.highConfidenceThreshold} onChange={v => update('confidence', 'highConfidenceThreshold', v)} />
              <SliderField label="Medium Confidence" description="Cases in this range are AI-assisted" value={config.confidence.mediumConfidenceThreshold} onChange={v => update('confidence', 'mediumConfidenceThreshold', v)} />
              <SliderField label="Low Confidence" description="Cases below this require mandatory human review" value={config.confidence.lowConfidenceThreshold} onChange={v => update('confidence', 'lowConfidenceThreshold', v)} />
            </div>
          )}

          {activeSection === 'dataSources' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">Data Sources</h2>
              <p className="text-xs text-slate-500 mb-4">Enable or disable payment data integrations.</p>
              <Toggle label="RazorpayX Payouts" description="Import payout data directly from RazorpayX API" value={config.dataSources.razorpayx} onChange={v => update('dataSources', 'razorpayx', v)} />
              <Toggle label="Bank Statement" description="Upload and process bank statement files" value={config.dataSources.bankStatement} onChange={v => update('dataSources', 'bankStatement', v)} />
              <Toggle label="ERP Integration" description="Connect to SAP/Oracle/Tally (coming soon)" value={config.dataSources.erpIntegration} onChange={v => update('dataSources', 'erpIntegration', v)} />
              <Toggle label="GSTR-2B" description="Import GST purchase register for cross-validation" value={config.dataSources.gstr2b} onChange={v => update('dataSources', 'gstr2b', v)} />
            </div>
          )}

          {activeSection === 'ai' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">AI Configuration</h2>
              <p className="text-xs text-slate-500 mb-4">Control how LedgerLens AI investigates difficult cases.</p>
              <TextField label="AI Model" value={config.ai.model} onChange={v => update('ai', 'model', v)} />
              <SliderField label="Max Investigation Depth" description="Maximum reasoning steps per case" value={config.ai.maxInvestigationDepth} min={1} max={10} step={1} unit=" steps" onChange={v => update('ai', 'maxInvestigationDepth', v)} />
              <Toggle label="Enable Explainability" description="Always include human-readable reasoning" value={config.ai.enableExplainability} onChange={v => update('ai', 'enableExplainability', v)} />
              <Toggle label="Enable Guardrails" description="AI cannot approve or reject — human required" value={config.ai.enableGuardrails} onChange={v => update('ai', 'enableGuardrails', v)} />
              <Toggle label="Require Human Review" description="Force FC approval for all AI recommendations" value={config.ai.humanReviewRequired} onChange={v => update('ai', 'humanReviewRequired', v)} />
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>Principle:</strong> LedgerLens AI follows "Deterministic First → AI Second".
                The AI never authorizes transactions directly — it investigates and recommends.
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">Notifications</h2>
              <p className="text-xs text-slate-500 mb-4">Configure alerting preferences.</p>
              <Toggle label="Email Alerts" description="Receive email on exception detection" value={config.notifications.emailAlerts} onChange={v => update('notifications', 'emailAlerts', v)} />
              <Toggle label="Slack Integration" description="Post alerts to Slack channel" value={config.notifications.slackIntegration} onChange={v => update('notifications', 'slackIntegration', v)} />
              <TextField label="Webhook URL" value={config.notifications.webhookUrl} onChange={v => update('notifications', 'webhookUrl', v)} placeholder="https://hooks.example.com/..." />
              <Toggle label="Alert on Exception" description="Notify immediately on new exception" value={config.notifications.alertOnException} onChange={v => update('notifications', 'alertOnException', v)} />
              <Toggle label="Daily Digest" description="Send daily reconciliation summary" value={config.notifications.dailyDigest} onChange={v => update('notifications', 'dailyDigest', v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
