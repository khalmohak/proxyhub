import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Globe2 } from 'lucide-react';

import { useAuth }      from './context/AuthContext';
import { settingsApi }  from './api';
import Layout           from './components/Layout';
import Dashboard        from './pages/Dashboard';
import Proxies          from './pages/Proxies';
import Logs             from './pages/Logs';
import Devices          from './pages/Devices';
import Settings         from './pages/Settings';
import Login            from './pages/Login';
import Onboarding       from './pages/Onboarding';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center animate-pulse">
          <Globe2 size={24} className="text-white" />
        </div>
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/proxies"  element={<Proxies />}   />
        <Route path="/logs"     element={<Logs />}      />
        <Route path="/devices"  element={<Devices />}   />
        <Route path="/settings" element={<Settings />}  />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const { isLoggedIn } = useAuth();
  // null = loading, true/false = resolved
  const [onboardingDone, setOnboardingDone] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    settingsApi.onboardingStatus()
      .then(r => setOnboardingDone(r.data.complete))
      .catch(() => setOnboardingDone(true)); // if API unreachable, assume done
  }, []);

  if (onboardingDone === null) return <Spinner />;

  return (
    <Routes>
      {/* Onboarding — only accessible before setup */}
      <Route
        path="/onboarding"
        element={
          onboardingDone
            ? <Navigate to="/" replace />
            : <Onboarding onComplete={() => setOnboardingDone(true)} />
        }
      />

      {/* Login — only accessible after onboarding, when not logged in */}
      <Route
        path="/login"
        element={
          !onboardingDone
            ? <Navigate to="/onboarding" replace />
            : isLoggedIn
              ? <Navigate to="/" replace />
              : <Login />
        }
      />

      {/* All other routes — require onboarding + login */}
      <Route
        path="/*"
        element={
          !onboardingDone
            ? <Navigate to="/onboarding" replace />
            : !isLoggedIn
              ? <Navigate to="/login" replace />
              : <ProtectedRoutes />
        }
      />
    </Routes>
  );
}
