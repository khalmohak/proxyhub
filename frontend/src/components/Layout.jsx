import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Globe2, ScrollText, Monitor, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { settingsApi } from '../api';
import { useEffect, useState } from 'react';

const nav = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/proxies',  label: 'Proxies',   icon: Globe2          },
  { to: '/logs',     label: 'Logs',      icon: ScrollText      },
  { to: '/devices',  label: 'Devices',   icon: Monitor         },
  { to: '/settings', label: 'Settings',  icon: Settings        },
];

export default function Layout({ children }) {
  const { logout, serverName, adminName } = useAuth();
  const [proxyPort, setProxyPort] = useState('8080');

  useEffect(() => {
    settingsApi.get()
      .then(r => { if (r.data.proxy_port) setProxyPort(r.data.proxy_port); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex flex-col w-60 shrink-0 bg-slate-900 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Globe2 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-none truncate">{serverName}</p>
            <p className="text-xs text-slate-400 mt-0.5">Proxy Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-indigo-600 text-white'
                   : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 space-y-3">
          {/* User row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <span className="text-indigo-300 text-xs font-bold">
                  {adminName?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <span className="text-xs text-slate-300 truncate">{adminName}</span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>

          {/* Server info */}
          <div className="space-y-0.5">
            <p className="text-xs text-slate-500">Proxy :  <span className="text-slate-400">{proxyPort}</span></p>
            <p className="text-xs text-slate-500">API  :  <span className="text-slate-400">3000</span></p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
