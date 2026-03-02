import { useEffect, useState } from 'react';
import {
  User, Lock, Server, RefreshCw, Save, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, Clock, Zap,
} from 'lucide-react';
import { settingsApi, proxiesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

/* ─── Helpers ────────────────────────────────────────────── */
function Toast({ type, msg }) {
  if (!msg) return null;
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  };
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-center gap-2 text-sm border rounded-xl px-4 py-2.5 ${styles[type]}`}>
      <Icon size={14} />
      {msg}
    </div>
  );
}

function SectionHeader({ icon: Icon, iconBg, title, description }) {
  return (
    <div className="settings-section-header">
      <div className={`settings-section-icon ${iconBg}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

/* ─── General Section ────────────────────────────────────── */
function GeneralSection({ settings, onSaved }) {
  const { login, token } = useAuth();
  const [form, setForm] = useState({ server_name: '', admin_name: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (settings) setForm({ server_name: settings.server_name || '', admin_name: settings.admin_name || '' });
  }, [settings]);

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      await settingsApi.update({ server_name: form.server_name, admin_name: form.admin_name });
      // Refresh identity in auth context
      login(token, { serverName: form.server_name, adminName: form.admin_name });
      setToast({ type: 'success', msg: 'Saved successfully.' });
      onSaved();
    } catch (err) {
      setToast({ type: 'error', msg: err.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <SectionHeader icon={User} iconBg="bg-indigo-500" title="General" description="Server identity shown across the dashboard" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Server / Organization Name</label>
          <input className="input" placeholder="ProxyHub" value={form.server_name} onChange={e => setForm(f => ({ ...f, server_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Your Name</label>
          <input className="input" placeholder="Admin" value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} />
        </div>
      </div>
      {toast && <Toast {...toast} />}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

/* ─── Security Section ───────────────────────────────────── */
function SecuritySection({ settings }) {
  const [form, setForm]   = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow]   = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const passwordFromEnv = settings?.password_source === 'env' || !!settings?.admin_password_env;

  const save = async () => {
    if (form.newPassword.length < 6) { setToast({ type: 'error', msg: 'New password must be at least 6 characters.' }); return; }
    if (form.newPassword !== form.confirm) { setToast({ type: 'error', msg: 'Passwords do not match.' }); return; }
    setSaving(true);
    setToast(null);
    try {
      await settingsApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setToast({ type: 'success', msg: 'Password updated successfully.' });
    } catch (err) {
      setToast({ type: 'error', msg: err.response?.data?.error || 'Failed to update password.' });
    } finally {
      setSaving(false);
    }
  };

  const tog = (f) => setShow(s => ({ ...s, [f]: !s[f] }));

  const Field = ({ label, field }) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show[field] ? 'text' : 'password'}
          className="input pr-9"
          value={form[field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirm']}
          onChange={e => setForm(f => ({ ...f, [field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirm']: e.target.value }))}
          placeholder={field === 'current' ? 'Current password' : field === 'new' ? 'Min. 6 characters' : 'Re-enter new password'}
        />
        <button type="button" onClick={() => tog(field)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show[field] ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="settings-section">
      <SectionHeader icon={Lock} iconBg="bg-violet-500" title="Security" description="Change your dashboard admin password" />
      {passwordFromEnv ? (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Password is managed via the <code className="font-mono text-xs bg-amber-100 px-1 rounded">ADMIN_PASSWORD</code> environment variable and cannot be changed here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Current Password" field="current" />
            <Field label="New Password" field="new" />
            <Field label="Confirm New Password" field="confirm" />
          </div>
          {toast && <Toast {...toast} />}
          <div className="flex justify-end">
            <button onClick={save} disabled={saving || !form.currentPassword || !form.newPassword} className="btn-primary">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
              Update Password
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Proxy Server Section ───────────────────────────────── */
function ProxyServerSection({ settings, onSaved }) {
  const [form, setForm]     = useState({ proxy_port: '8080', require_auth: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);

  useEffect(() => {
    if (settings) setForm({
      proxy_port:   settings.proxy_port   || '8080',
      require_auth: settings.require_auth === 'true',
    });
  }, [settings]);

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      await settingsApi.update({ proxy_port: form.proxy_port, require_auth: String(form.require_auth) });
      setToast({ type: 'success', msg: 'Saved. Restart the proxy server to apply port changes.' });
      onSaved();
    } catch (err) {
      setToast({ type: 'error', msg: err.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <SectionHeader icon={Server} iconBg="bg-sky-500" title="Proxy Server" description="Configure how the rotating proxy server behaves" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Proxy Port</label>
          <input type="number" className="input" value={form.proxy_port} onChange={e => setForm(f => ({ ...f, proxy_port: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1.5">Changing the port requires restarting the server.</p>
        </div>
        <div>
          <label className="label">Require API Key Auth</label>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, require_auth: !f.require_auth }))}
            className={`flex items-center gap-3 w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors
              ${form.require_auth
                ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                : 'bg-gray-50 border-gray-200 text-gray-600'}`}
          >
            <div className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${form.require_auth ? 'bg-indigo-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.require_auth ? 'translate-x-4' : ''}`} />
            </div>
            {form.require_auth ? 'Enabled — only registered devices' : 'Disabled — open access'}
          </button>
        </div>
      </div>
      {toast && <Toast {...toast} />}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

/* ─── Auto Sync Section ──────────────────────────────────── */
function AutoSyncSection({ settings, syncStatus, onSyncNow }) {
  const intervalMin = settings?.sync_interval_minutes
    || (typeof window !== 'undefined' ? '30' : '30');

  const lastSync = settings?.last_auto_sync
    ? (() => { try { return formatDistanceToNow(new Date(settings.last_auto_sync), { addSuffix: true }); } catch { return null; } })()
    : null;

  return (
    <div className="settings-section">
      <SectionHeader icon={RefreshCw} iconBg="bg-emerald-500" title="Auto Sync" description="Automatic proxy health checks and metadata refresh" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Interval</p>
          <p className="text-lg font-bold text-gray-900">
            {parseInt(intervalMin) > 0 ? `${intervalMin} min` : 'Disabled'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Set via <code className="font-mono">SYNC_INTERVAL_MINUTES</code></p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Last Sync</p>
          <p className="text-sm font-semibold text-gray-900">{lastSync || 'Never'}</p>
          {syncStatus?.finishedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              {syncStatus.results?.filter(r => r.healthy).length}/{syncStatus.total} healthy
            </p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Status</p>
          {syncStatus?.running ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-sm font-semibold text-indigo-700">
                Syncing {syncStatus.current}/{syncStatus.total}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-sm font-semibold text-gray-700">Idle</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSyncNow} disabled={syncStatus?.running} className="btn-secondary">
          {syncStatus?.running
            ? <><Loader2 size={13} className="animate-spin" /> Syncing…</>
            : <><Zap size={13} /> Sync Now</>
          }
        </button>
      </div>
    </div>
  );
}

/* ─── Main Settings Page ─────────────────────────────────── */
export default function Settings() {
  const [settings, setSettings]     = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading]       = useState(true);

  const loadSettings = async () => {
    try {
      const [s, ss] = await Promise.all([settingsApi.get(), proxiesApi.syncStatus()]);
      setSettings(s.data);
      setSyncStatus(ss.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadSettings();
    // Poll sync status
    const t = setInterval(async () => {
      try {
        const r = await proxiesApi.syncStatus();
        setSyncStatus(r.data);
      } catch (_) {}
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const triggerSync = async () => {
    try {
      await proxiesApi.syncMetadata();
      const r = await proxiesApi.syncStatus();
      setSyncStatus(r.data);
    } catch (_) {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your ProxyHub configuration</p>
      </div>

      <GeneralSection     settings={settings} onSaved={loadSettings} />
      <SecuritySection    settings={settings} />
      <ProxyServerSection settings={settings} onSaved={loadSettings} />
      <AutoSyncSection    settings={settings} syncStatus={syncStatus} onSyncNow={triggerSync} />
    </div>
  );
}
