import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Power, Copy, Check, X, Eye, EyeOff, Loader2, Monitor, Info } from 'lucide-react';
import { devicesApi } from '../api';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );
}

function ApiKeyCell({ apiKey }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1 font-mono text-xs">
      <span className={show ? 'text-gray-800' : 'text-gray-400 tracking-widest select-none'}>
        {show ? apiKey : '••••••••••••••••••••'}
      </span>
      <button onClick={() => setShow(s => !s)} className="p-1 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <CopyButton text={apiKey} />
    </div>
  );
}

/* ─── New Device Created Card ─────────────────────────────── */
function NewDeviceCard({ device, onClose }) {
  const proxyHost = window.location.hostname;

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-green-800 mb-1">Device registered!</p>
        <p className="text-xs text-green-700">Save the API key below — it won't be shown again in full.</p>
      </div>

      <div>
        <label className="label">API Key</label>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <code className="flex-1 text-xs font-mono text-indigo-700 break-all">{device.api_key}</code>
          <CopyButton text={device.api_key} />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Info size={13}/>How to connect</p>
        <div className="space-y-1.5">
          {[
            ['Proxy URL', `http://${device.api_key}:${device.api_key}@${proxyHost}:8080`],
            ['HTTP_PROXY',  `http://${device.api_key}:${device.api_key}@${proxyHost}:8080`],
            ['HTTPS_PROXY', `http://${device.api_key}:${device.api_key}@${proxyHost}:8080`],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 mt-0.5">
                <code className="text-xs text-slate-700 flex-1 break-all">{val}</code>
                <CopyButton text={val} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Use the same value for both username and password when prompting for credentials.
        </p>
      </div>

      <button onClick={onClose} className="btn-primary w-full">Done</button>
    </div>
  );
}

/* ─── Register Device Modal ───────────────────────────────── */
function RegisterModal({ onClose, onCreated }) {
  const [form, setForm]   = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [err, setErr]     = useState('');

  if (created) return <NewDeviceCard device={created} onClose={() => { onClose(); onCreated(); }} />;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const res = await devicesApi.create(form);
      setCreated(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to register device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Device Name *</label>
        <input className="input" placeholder="My MacBook / iPhone 15 / k6 Runner" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <input className="input" placeholder="Load tester on prod server" value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          Register Device
        </button>
      </div>
    </form>
  );
}

/* ─── Connection Instructions Card ───────────────────────── */
function InstructionsCard() {
  const host = window.location.hostname;
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Info size={15} className="text-indigo-500" />
        How to Connect a Device
      </h2>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-slate-800">System Proxy (macOS / Windows)</p>
          <p className="text-xs text-slate-600">Go to Network Settings → Proxy → HTTP/HTTPS Proxy</p>
          <div className="font-mono text-xs bg-white border border-slate-200 rounded p-2 space-y-1">
            <p>Host: <span className="text-indigo-600">{host}</span></p>
            <p>Port: <span className="text-indigo-600">8080</span></p>
            <p>User: <span className="text-indigo-600">&lt;api_key&gt;</span></p>
            <p>Pass: <span className="text-indigo-600">&lt;api_key&gt;</span></p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-slate-800">Environment Variables</p>
          <p className="text-xs text-slate-600">Add to your shell profile or CI environment</p>
          <div className="font-mono text-xs bg-white border border-slate-200 rounded p-2 space-y-1">
            <p>export HTTP_PROXY=</p>
            <p className="text-indigo-600 break-all">  http://KEY:KEY@{host}:8080</p>
            <p>export HTTPS_PROXY=</p>
            <p className="text-indigo-600 break-all">  http://KEY:KEY@{host}:8080</p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-slate-800">Browser / curl</p>
          <p className="text-xs text-slate-600">Use with curl, wget, or browser extensions</p>
          <div className="font-mono text-xs bg-white border border-slate-200 rounded p-2 space-y-1">
            <p>curl --proxy \</p>
            <p className="text-indigo-600 break-all">  http://KEY:KEY@{host}:8080 \</p>
            <p>  https://api.ipify.org</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Replace <code className="bg-gray-100 px-1 rounded">KEY</code> with the device's API key.
        If <code className="bg-gray-100 px-1 rounded">REQUIRE_AUTH=false</code>, credentials are optional.
      </p>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function Devices() {
  const [devices, setDevices]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await devicesApi.list();
      setDevices(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id) => {
    await devicesApi.toggle(id);
    setDevices(ds => ds.map(d => d.id === id ? { ...d, is_active: !d.is_active } : d));
  };

  const remove = async (id) => {
    if (!confirm('Delete this device? Its logs will be retained.')) return;
    await devicesApi.remove(id);
    setDevices(ds => ds.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {devices.length} registered · {devices.filter(d => d.is_active).length} active
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm">
          <Plus size={14} /> Register Device
        </button>
      </div>

      {/* Instructions */}
      <InstructionsCard />

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Description</th>
                <th className="table-th">API Key</th>
                <th className="table-th">Status</th>
                <th className="table-th">Requests</th>
                <th className="table-th">Registered</th>
                <th className="table-th">Last Used</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="table-td text-center py-10 text-gray-400">Loading…</td></tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-td text-center py-10">
                    <Monitor size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-gray-400">No devices yet. Register your first device above.</p>
                  </td>
                </tr>
              ) : devices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium text-gray-900">{d.name}</td>
                  <td className="table-td text-gray-500 text-xs max-w-xs truncate">{d.description || <span className="text-gray-300">—</span>}</td>
                  <td className="table-td"><ApiKeyCell apiKey={d.api_key} /></td>
                  <td className="table-td">
                    {d.is_active
                      ? <span className="badge-green"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Active</span>
                      : <span className="badge-gray">Inactive</span>}
                  </td>
                  <td className="table-td tabular-nums">{d.total_requests ?? 0}</td>
                  <td className="table-td text-xs text-gray-400">
                    {format(new Date(d.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="table-td text-xs text-gray-400">
                    {d.last_used_at ? format(new Date(d.last_used_at), 'MMM d, HH:mm') : '—'}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggle(d.id)}
                        title={d.is_active ? 'Disable' : 'Enable'}
                        className={`p-1.5 rounded-md transition-colors ${d.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        onClick={() => remove(d.id)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Device">
        <RegisterModal onClose={() => setShowModal(false)} onCreated={load} />
      </Modal>
    </div>
  );
}
