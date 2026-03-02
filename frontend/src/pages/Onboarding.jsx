import { useState, useEffect } from 'react';
import { Globe2, CheckCircle2, Eye, EyeOff, ChevronRight, Loader2, Shield } from 'lucide-react';
import { settingsApi, authApi } from '../api';
import { useAuth } from '../context/AuthContext';

const TOTAL_STEPS = 4;

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${i < current  ? 'bg-indigo-500 text-white'       : ''}
            ${i === current ? 'bg-indigo-500 text-white ring-4 ring-indigo-500/30' : ''}
            ${i > current  ? 'bg-slate-800 text-slate-500'   : ''}
          `}>
            {i < current ? <CheckCircle2 size={14} /> : i + 1}
          </div>
          {i < TOTAL_STEPS - 1 && (
            <div className={`h-0.5 w-8 rounded-full transition-all ${i < current ? 'bg-indigo-500' : 'bg-slate-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Step 1: Welcome ─────────────────────────────────────── */
function StepWelcome({ data, onChange, onNext }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Welcome to ProxyHub</h2>
        <p className="text-slate-400 text-sm">
          Let's get your proxy manager set up. This only takes a minute.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Server / Organization Name *
          </label>
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Acme Proxy Farm"
            value={data.server_name}
            onChange={e => onChange('server_name', e.target.value)}
            autoFocus
          />
          <p className="text-xs text-slate-500 mt-1">Shown in the sidebar and login screen.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Your Name *
          </label>
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Alex"
            value={data.admin_name}
            onChange={e => onChange('admin_name', e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">How we address you in the dashboard.</p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!data.server_name.trim() || !data.admin_name.trim()}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        Continue <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ─── Step 2: Security ────────────────────────────────────── */
function StepSecurity({ data, onChange, onNext, onBack, passwordFromEnv }) {
  const [show, setShow]     = useState(false);
  const [showC, setShowC]   = useState(false);
  const [error, setError]   = useState('');

  const next = () => {
    if (passwordFromEnv) { onNext(); return; }
    if (data.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (data.password !== data.confirm) { setError('Passwords do not match.'); return; }
    setError('');
    onNext();
  };

  if (passwordFromEnv) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Security</h2>
          <p className="text-slate-400 text-sm">Your admin password is managed via the <code className="text-indigo-400 text-xs">ADMIN_PASSWORD</code> environment variable.</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3">
          <Shield size={18} className="text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-indigo-300">Password set via environment</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Dashboard access is protected by the <code className="text-indigo-400">ADMIN_PASSWORD</code> env var. No action needed here.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">Back</button>
          <button onClick={onNext} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
            Continue <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Secure Your Dashboard</h2>
        <p className="text-slate-400 text-sm">Set an admin password to protect access to ProxyHub.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Admin Password *</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min. 6 characters"
              value={data.password}
              onChange={e => onChange('password', e.target.value)}
              autoFocus
            />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password *</label>
          <div className="relative">
            <input
              type={showC ? 'text' : 'password'}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Re-enter password"
              value={data.confirm}
              onChange={e => onChange('confirm', e.target.value)}
            />
            <button type="button" onClick={() => setShowC(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showC ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">Back</button>
        <button onClick={next} disabled={!data.password} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 3: Server Config ───────────────────────────────── */
function StepServer({ data, onChange, onNext, onBack }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Proxy Server Config</h2>
        <p className="text-slate-400 text-sm">Configure how your rotating proxy server behaves.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Proxy Server Port</label>
          <input
            type="number"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="8080"
            value={data.proxy_port}
            onChange={e => onChange('proxy_port', e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">Devices will connect to this port. Default: 8080.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Require API Key Auth</label>
          <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg p-3">
            <button
              type="button"
              onClick={() => onChange('require_auth', !data.require_auth)}
              className={`relative w-11 h-6 rounded-full transition-colors ${data.require_auth ? 'bg-indigo-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${data.require_auth ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <div>
              <p className="text-sm text-white font-medium">{data.require_auth ? 'Enabled' : 'Disabled'}</p>
              <p className="text-xs text-slate-400">
                {data.require_auth
                  ? 'Only registered devices with a valid API key can use the proxy.'
                  : 'Any client can connect without a key (open mode).'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">Back</button>
        <button onClick={onNext} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: Done ────────────────────────────────────────── */
function StepDone({ data, loading, error, onFinish }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <CheckCircle2 size={32} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">You're all set!</h2>
          <p className="text-slate-400 text-sm mt-1">Here's a summary of your configuration.</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 text-left space-y-3">
        {[
          { label: 'Server Name',   value: data.server_name },
          { label: 'Admin',         value: data.admin_name  },
          { label: 'Proxy Port',    value: `:${data.proxy_port || 8080}` },
          { label: 'Auth Required', value: data.require_auth ? 'Yes' : 'No' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{label}</span>
            <span className="text-sm font-medium text-white">{value}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={onFinish}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? 'Setting up…' : 'Go to Dashboard →'}
      </button>
    </div>
  );
}

/* ─── Main Onboarding Page ────────────────────────────────── */
export default function Onboarding({ onComplete }) {
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [passwordFromEnv, setPFE]     = useState(false);

  const [data, setData] = useState({
    server_name:  '',
    admin_name:   '',
    password:     '',
    confirm:      '',
    proxy_port:   '8080',
    require_auth: false,
  });

  useEffect(() => {
    settingsApi.onboardingStatus()
      .then(r => setPFE(r.data.passwordFromEnv))
      .catch(() => {});
  }, []);

  const set = (key, val) => setData(d => ({ ...d, [key]: val }));

  const finish = async () => {
    setLoading(true);
    setError('');
    try {
      await settingsApi.setup({
        server_name:  data.server_name,
        admin_name:   data.admin_name,
        password:     data.password || undefined,
        proxy_port:   data.proxy_port,
        require_auth: data.require_auth,
      });
      // Auto-login using the password the user just set
      // (if passwordFromEnv, they'll be redirected to /login to enter it manually)
      if (data.password) {
        const loginRes = await authApi.login({ password: data.password });
        login(loginRes.data.token, {
          serverName: loginRes.data.serverName,
          adminName:  loginRes.data.adminName,
        });
      }
      onComplete();
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
      setLoading(false);
    }
  };

  const stepLabels = ['Welcome', 'Security', 'Server', 'Review'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Globe2 size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-none">ProxyHub</p>
            <p className="text-slate-400 text-xs mt-0.5">Initial Setup</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <StepIndicator current={step} />

          {step === 0 && <StepWelcome data={data} onChange={set} onNext={() => setStep(1)} />}
          {step === 1 && (
            <StepSecurity
              data={data} onChange={set}
              onNext={() => setStep(2)} onBack={() => setStep(0)}
              passwordFromEnv={passwordFromEnv}
            />
          )}
          {step === 2 && <StepServer data={data} onChange={set} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <StepDone data={data} loading={loading} error={error} onFinish={finish} />}
        </div>

        {/* Step labels */}
        <div className="flex justify-center gap-6 mt-4">
          {stepLabels.map((label, i) => (
            <span key={label} className={`text-xs transition-colors ${i === step ? 'text-indigo-400 font-medium' : 'text-slate-600'}`}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
