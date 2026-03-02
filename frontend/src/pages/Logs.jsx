import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Download, Filter, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { logsApi, proxiesApi, devicesApi } from '../api';

const STATUS_COLORS = {
  success:     'badge-green',
  auth_failed: 'badge-red',
  no_proxy:    'badge-yellow',
  error:       'badge-red',
};

export default function Logs() {
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [proxies, setProxies] = useState([]);
  const [devices, setDevices] = useState([]);
  const [page, setPage]       = useState(0);
  const PER_PAGE = 50;

  const [filters, setFilters] = useState({
    proxy_id:  '',
    device_id: '',
    status:    '',
    from:      '',
    to:        '',
    target:    '',
  });

  const setFilter = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));
  const clearFilters = () => setFilters({ proxy_id: '', device_id: '', status: '', from: '', to: '', target: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PER_PAGE, offset: page * PER_PAGE };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await logsApi.list(params);
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    proxiesApi.list().then(r => setProxies(r.data)).catch(() => {});
    devicesApi.list().then(r => setDevices(r.data)).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / PER_PAGE);

  const exportUrl = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return logsApi.export(params);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total entries</p>
        </div>
        <div className="flex gap-2">
          <a href={exportUrl()} download="proxy-logs.csv" className="btn-secondary btn-sm">
            <Download size={14} /> Export CSV
          </a>
          <button onClick={() => { setPage(0); load(); }} className="btn-secondary btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {activeFilterCount} active
            </span>
          )}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="label">Proxy</label>
            <select className="input" value={filters.proxy_id} onChange={setFilter('proxy_id')}>
              <option value="">All proxies</option>
              {proxies.map(p => (
                <option key={p.id} value={p.id}>{p.host}:{p.port}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Device</label>
            <select className="input" value={filters.device_id} onChange={setFilter('device_id')}>
              <option value="">All devices</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status} onChange={setFilter('status')}>
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="auth_failed">Auth Failed</option>
              <option value="no_proxy">No Proxy</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="label">Target contains</label>
            <input className="input" placeholder="e.g. google.com" value={filters.target} onChange={setFilter('target')} />
          </div>
          <div>
            <label className="label">From</label>
            <input className="input" type="datetime-local" value={filters.from} onChange={setFilter('from')} />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input" type="datetime-local" value={filters.to} onChange={setFilter('to')} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Time</th>
                <th className="table-th">Target</th>
                <th className="table-th">Proxy Used</th>
                <th className="table-th">Device</th>
                <th className="table-th">Type</th>
                <th className="table-th">Status</th>
                <th className="table-th">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="table-td text-center py-10 text-gray-400">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="table-td text-center py-10 text-gray-400">No log entries found.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td text-xs text-gray-500 font-mono">
                    {format(new Date(log.created_at), 'MMM d HH:mm:ss')}
                  </td>
                  <td className="table-td font-mono text-xs max-w-xs truncate" title={log.target_host}>
                    {log.target_host}
                    {log.target_port && log.target_port !== 80 && log.target_port !== 443
                      ? `:${log.target_port}`
                      : ''}
                  </td>
                  <td className="table-td font-mono text-xs text-gray-500">
                    {log.upstream_proxy || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td">
                    {log.device_name
                      ? <span className="badge-gray">{log.device_name}</span>
                      : <span className="text-gray-300 text-xs">anon</span>}
                  </td>
                  <td className="table-td">
                    <span className={log.is_https ? 'badge-green' : 'badge-gray'}>
                      {log.is_https ? 'HTTPS' : 'HTTP'}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={STATUS_COLORS[log.status] || 'badge-gray'}>
                      {log.status}
                    </span>
                  </td>
                  <td className="table-td tabular-nums text-xs text-gray-500">
                    {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page + 1} of {totalPages} · {total.toLocaleString()} results
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary btn-sm px-2"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary btn-sm px-2"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
