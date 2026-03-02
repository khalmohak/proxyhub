import { useEffect, useState, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Plus, Upload, ShieldCheck, Trash2, Power, X, CheckCircle2, XCircle, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { proxiesApi } from '../api';

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/* ─── Sync Progress Panel ────────────────────────────────── */
function SyncPanel({ status, onDismiss }) {
  if (!status || (!status.running && !status.finishedAt)) return null;

  const pct     = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
  const healthy = status.results?.filter(r => r.healthy).length ?? 0;
  const failed  = status.results?.filter(r => r.healthy === false).length ?? 0;
  const isDone  = !status.running && status.finishedAt;
  const recent  = (status.results ?? []).slice(-3).reverse();

  return (
    <div className={`fixed bottom-6 right-6 z-40 w-96 card shadow-2xl overflow-hidden
      transition-all duration-300 ${status.running || isDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${isDone ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
        <div className="flex items-center gap-2">
          {isDone
            ? <CheckCircle2 size={15} className="text-emerald-600" />
            : <RefreshCw size={15} className="text-indigo-600 animate-spin" />
          }
          <span className={`text-sm font-semibold ${isDone ? 'text-emerald-800' : 'text-indigo-800'}`}>
            {isDone ? 'Sync Complete' : `Syncing Proxies…`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium tabular-nums ${isDone ? 'text-emerald-600' : 'text-indigo-600'}`}>
            {status.current}/{status.total}
          </span>
          {isDone && (
            <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${isDone ? 100 : pct}%` }}
        />
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Summary counts */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 size={12} /> {healthy} healthy
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <XCircle size={12} /> {failed} failed
            </span>
          )}
          {status.triggeredBy === 'auto' && (
            <span className="ml-auto text-gray-400">auto</span>
          )}
        </div>

        {/* Recent results */}
        {recent.length > 0 && (
          <div className="space-y-1">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                {r.healthy
                  ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                  : <XCircle size={11} className="text-red-400 shrink-0" />
                }
                <span className="font-mono text-gray-500 truncate">{r.host}:{r.port}</span>
                {r.healthy && r.country_code && (
                  <span className="shrink-0">{countryFlag(r.country_code)}</span>
                )}
                {r.healthy && r.city && (
                  <span className="text-gray-400 truncate">{r.city}</span>
                )}
                {r.healthy && r.duration_ms && (
                  <span className="ml-auto text-gray-400 tabular-nums shrink-0">{r.duration_ms}ms</span>
                )}
                {!r.healthy && (
                  <span className="ml-auto text-red-400 shrink-0">fail</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────── */
function StatusBadge({ active, healthy }) {
  if (!active)  return <span className="badge-gray">Inactive</span>;
  if (!healthy) return <span className="badge-red">Unhealthy</span>;
  return <span className="badge-green"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Active</span>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ─── Add Single Proxy Modal ──────────────────────────────── */
function AddProxyModal({ onClose, onAdded }) {
  const [form, setForm]   = useState({ host: '', port: '', username: '', password: '', protocol: 'http', label: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await proxiesApi.add({ ...form, port: parseInt(form.port) });
      onAdded();
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to add proxy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Host / IP *</label>
          <input className="input" placeholder="1.2.3.4" value={form.host} onChange={set('host')} required />
        </div>
        <div>
          <label className="label">Port *</label>
          <input className="input" placeholder="8080" type="number" value={form.port} onChange={set('port')} required />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" placeholder="user" value={form.username} onChange={set('username')} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" placeholder="pass" type="password" value={form.password} onChange={set('password')} />
        </div>
        <div>
          <label className="label">Protocol</label>
          <select className="input" value={form.protocol} onChange={set('protocol')}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input className="input" placeholder="e.g. US Residential" value={form.label} onChange={set('label')} />
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          Add Proxy
        </button>
      </div>
    </form>
  );
}

/* ─── Bulk Upload Modal ───────────────────────────────────── */
function BulkModal({ onClose, onAdded }) {
  const [text, setText]     = useState('');
  const [file, setFile]     = useState(null);
  const [protocol, setProtocol] = useState('http');
  const [label, setLabel]   = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      let res;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('protocol', protocol);
        fd.append('label', label);
        res = await proxiesApi.bulk(fd);
      } else {
        res = await proxiesApi.bulkText({ text, protocol, label });
      }
      setResult(res.data);
      onAdded();
    } catch (ex) {
      setResult({ error: ex.response?.data?.error || 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Paste proxies (one per line: <code className="text-xs bg-gray-100 px-1 rounded">host:port:user:pass</code>)</label>
        <textarea
          className="input h-44 font-mono text-xs resize-none"
          placeholder={"89.249.192.26:6425:ptpnsihl:aofnhs209sbr\n104.253.91.77:6510:ptpnsihl:aofnhs209sbr"}
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={!!file}
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>– or –</span>
        <label className="btn-secondary cursor-pointer">
          <Upload size={14} /> Upload .txt file
          <input type="file" accept=".txt,text/plain" className="hidden" onChange={e => setFile(e.target.files[0])} />
        </label>
        {file && <span className="text-xs text-indigo-600 font-medium">{file.name}</span>}
        {file && <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Protocol</label>
          <select className="input" value={protocol} onChange={e => setProtocol(e.target.value)}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input className="input" placeholder="e.g. Batch Jan 2025" value={label} onChange={e => setLabel(e.target.value)} />
        </div>
      </div>

      {result && (
        <div className={`rounded-lg p-3 text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {result.error
            ? result.error
            : <>Added <strong>{result.added}</strong> of <strong>{result.total}</strong> proxies.
               {result.errors?.length > 0 && <span className="ml-1">({result.errors.length} errors)</span>}</>
          }
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        <button type="submit" className="btn-primary" disabled={saving || (!text.trim() && !file)}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          Import Proxies
        </button>
      </div>
    </form>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function Proxies() {
  const [proxies, setProxies]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [checking, setChecking]   = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [showBulk, setShowBulk]   = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [checkResults, setCheckResults] = useState({});
  const [syncStatus, setSyncStatus]   = useState(null);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const syncPollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await proxiesApi.list();
      setProxies(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll sync status whenever panel is visible
  useEffect(() => {
    if (showSyncPanel) {
      syncPollRef.current = setInterval(async () => {
        try {
          const r = await proxiesApi.syncStatus();
          setSyncStatus(r.data);
          // Refresh proxy list when sync finishes
          if (!r.data.running && syncStatus?.running) load();
        } catch (_) {}
      }, 600);
    } else {
      clearInterval(syncPollRef.current);
    }
    return () => clearInterval(syncPollRef.current);
  }, [showSyncPanel, syncStatus?.running, load]);

  const toggle = async (id) => {
    await proxiesApi.toggle(id);
    setProxies(ps => ps.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p));
  };

  const remove = async (id) => {
    if (!confirm('Delete this proxy?')) return;
    await proxiesApi.remove(id);
    setProxies(ps => ps.filter(p => p.id !== id));
  };

  const checkOne = async (id) => {
    setCheckingId(id);
    try {
      const res = await proxiesApi.check(id);
      setCheckResults(r => ({ ...r, [id]: res.data }));
      setProxies(ps => ps.map(p => p.id === id ? { ...p, is_healthy: res.data.healthy } : p));
    } catch (_) {}
    setCheckingId(null);
  };

  const checkAll = async () => {
    setChecking(true);
    try {
      const res = await proxiesApi.checkAll();
      const map = {};
      res.data.results.forEach(r => { map[r.id] = r; });
      setCheckResults(map);
      await load();
    } catch (_) {}
    setChecking(false);
  };

  const syncMetadata = async () => {
    setSyncing(true);
    try {
      const r = await proxiesApi.syncMetadata();
      setSyncStatus(r.data);
      setShowSyncPanel(true);
    } catch (_) {}
    setSyncing(false);
  };

  const stats = {
    total:   proxies.length,
    active:  proxies.filter(p => p.is_active).length,
    healthy: proxies.filter(p => p.is_healthy).length,
    ready:   proxies.filter(p => p.is_active && p.is_healthy).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proxies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total} total · {stats.active} active · {stats.healthy} healthy</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncMetadata} className="btn-secondary btn-sm" disabled={syncing}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            Sync Metadata
          </button>
          <button onClick={checkAll} className="btn-secondary btn-sm" disabled={checking}>
            {checking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Check All
          </button>
          <button onClick={() => setShowBulk(true)} className="btn-secondary btn-sm">
            <Upload size={14} /> Bulk Upload
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">
            <Plus size={14} /> Add Proxy
          </button>
        </div>
      </div>

      {/* Stat Pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Total',   val: stats.total,   color: 'bg-gray-100 text-gray-700'    },
          { label: 'Active',  val: stats.active,  color: 'bg-indigo-100 text-indigo-700' },
          { label: 'Healthy', val: stats.healthy, color: 'bg-green-100 text-green-700'  },
          { label: 'Ready',   val: stats.ready,   color: 'bg-emerald-100 text-emerald-700' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`px-4 py-1.5 rounded-full text-sm font-medium ${color}`}>
            {val} {label}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Host : Port</th>
                <th className="table-th">Location</th>
                <th className="table-th">ISP</th>
                <th className="table-th">Label</th>
                <th className="table-th">Proto</th>
                <th className="table-th">Status</th>
                <th className="table-th">Requests</th>
                <th className="table-th">Last Used</th>
                <th className="table-th">Last Checked</th>
                <th className="table-th">Health Check</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={11} className="table-td text-center py-8 text-gray-400">Loading…</td></tr>
              ) : proxies.length === 0 ? (
                <tr><td colSpan={11} className="table-td text-center py-8 text-gray-400">No proxies yet — add some above.</td></tr>
              ) : proxies.map((p) => {
                const cr = checkResults[p.id];
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td font-mono text-xs font-semibold text-gray-800">
                      {p.host}:{p.port}
                      {p.resolved_ip && p.resolved_ip !== p.host && (
                        <div className="text-gray-400 font-normal mt-0.5">{p.resolved_ip}</div>
                      )}
                    </td>
                    <td className="table-td text-sm">
                      {p.country_code ? (
                        <span title={p.country} className="flex items-center gap-1.5">
                          <span className="text-base leading-none">{countryFlag(p.country_code)}</span>
                          <span className="text-gray-600 text-xs">{p.city || p.country || p.country_code}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="table-td text-xs text-gray-500 max-w-[140px] truncate" title={p.isp}>
                      {p.isp || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-td text-gray-500">{p.label || <span className="text-gray-300">—</span>}</td>
                    <td className="table-td uppercase text-xs font-mono">{p.protocol}</td>
                    <td className="table-td"><StatusBadge active={p.is_active} healthy={p.is_healthy} /></td>
                    <td className="table-td tabular-nums">{p.total_requests}</td>
                    <td className="table-td text-gray-400 text-xs">
                      {p.last_used_at ? format(new Date(p.last_used_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="table-td text-gray-400 text-xs">
                      {p.last_checked_at ? format(new Date(p.last_checked_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="table-td">
                      {cr ? (
                        cr.healthy
                          ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={13}/>{cr.ip} ({cr.duration_ms}ms)</span>
                          : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={13}/>Fail</span>
                      ) : (
                        <button
                          onClick={() => checkOne(p.id)}
                          className="btn-secondary btn-sm"
                          disabled={checkingId === p.id}
                        >
                          {checkingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                          Test
                        </button>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggle(p.id)}
                          title={p.is_active ? 'Disable' : 'Enable'}
                          className={`p-1.5 rounded-md transition-colors ${p.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal open={showAdd}  onClose={() => setShowAdd(false)}  title="Add Proxy">
        <AddProxyModal onClose={() => setShowAdd(false)} onAdded={load} />
      </Modal>
      <Modal open={showBulk} onClose={() => setShowBulk(false)} title="Bulk Upload Proxies">
        <BulkModal onClose={() => setShowBulk(false)} onAdded={load} />
      </Modal>

      {/* Sync Progress Panel */}
      <SyncPanel
        status={showSyncPanel ? syncStatus : null}
        onDismiss={() => { setShowSyncPanel(false); load(); }}
      />
    </div>
  );
}
