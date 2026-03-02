import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Globe2, CheckCircle2, Monitor, Activity, TrendingUp, RefreshCw, Wifi,
} from 'lucide-react';
import { statsApi } from '../api';

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50  text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    orange: 'bg-orange-50 text-orange-600',
    sky:    'bg-sky-50    text-sky-600',
  };
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '–'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await statsApi.get();
      setStats(res.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const hourlyData = (stats?.hourly ?? []).map((h) => ({
    hour:    format(parseISO(h.hour), 'HH:mm'),
    success: parseInt(h.success),
    failed:  parseInt(h.failed),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastRefresh ? `Last refreshed ${format(lastRefresh, 'HH:mm:ss')}` : 'Loading…'}
          </p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Globe2}
          label="Total Proxies"
          value={stats?.proxies?.total}
          sub={`${stats?.proxies?.active ?? 0} active`}
          color="indigo"
        />
        <StatCard
          icon={CheckCircle2}
          label="Healthy"
          value={stats?.proxies?.ready}
          sub="active & healthy"
          color="green"
        />
        <StatCard
          icon={Monitor}
          label="Devices"
          value={stats?.devices?.total}
          sub={`${stats?.devices?.active ?? 0} active`}
          color="violet"
        />
        <StatCard
          icon={Activity}
          label="Requests / 1h"
          value={stats?.logs?.last_hour}
          sub={`${stats?.logs?.last_day ?? 0} today`}
          color="orange"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Requests"
          value={stats?.logs?.total}
          sub={`${stats?.logs?.failed ?? 0} failed`}
          color="sky"
        />
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Wifi size={15} className="text-indigo-500" />
          Requests per Hour (last 24 h)
        </h2>
        {hourlyData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="success" name="Success" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed"  name="Failed"  fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top proxies */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Proxies by Usage</h2>
          {(stats?.topProxies ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <div className="space-y-2">
              {stats.topProxies.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.host}:{p.port}</p>
                    {p.label && <p className="text-xs text-gray-400">{p.label}</p>}
                  </div>
                  <span className="text-sm font-semibold text-indigo-600">{p.total_requests}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top devices */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Devices by Usage</h2>
          {(stats?.topDevices ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No devices registered yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topDevices.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <p className="text-sm font-medium text-gray-800">{d.name}</p>
                  <span className="text-sm font-semibold text-violet-600">{d.requests}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
