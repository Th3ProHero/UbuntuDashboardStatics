import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Server, Box, Network, Cpu, Bell, Cloud, X, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';
import Dashboard from './pages/Dashboard';
import DockerSection from './pages/DockerSection';
import ServicesMap from './pages/ServicesMap';
import ProcessExplorer from './pages/ProcessExplorer';
import Cloudflare from './pages/Cloudflare';
import { useStore } from './store';
import { ToastContainer } from './components/Toast';

// Connecting to the backend running on the same host
const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:9091' : '/');
const getApiUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:9091' : '';

// ─── Health Alert Modal ────────────────────────────────────────────────────────
interface HealthAlert {
  level: 'danger' | 'warning' | 'ok';
  message: string;
}

interface HealthData {
  healthy: boolean;
  alertCount: number;
  alerts: HealthAlert[];
  snapshot: {
    cpu: number;
    ram: number;
    disk: number;
    zombies: number;
    swap: number;
  };
}

function HealthModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/health-status`);
      if (!res.ok) throw new Error('Error al consultar el estado del sistema');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const levelColor = {
    danger:  'border-red-500/30 bg-red-500/8 text-red-300',
    warning: 'border-amber-500/30 bg-amber-500/8 text-amber-300',
    ok:      'border-emerald-500/30 bg-emerald-500/8 text-emerald-300',
  };
  const levelIcon = {
    danger:  <AlertTriangle size={14} className="text-red-400 shrink-0" />,
    warning: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
    ok:      <CheckCircle2  size={14} className="text-emerald-400 shrink-0" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0f0f14] border border-panelBorder rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(99,102,241,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/3">
          <Bell size={16} className="text-accent" />
          <h3 className="font-semibold text-sm text-white flex-1">Estado del Sistema</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin" />
              Consultando estado...
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Healthy banner */}
              {data.healthy ? (
                <div className="flex flex-col items-center gap-2 py-5 text-emerald-400">
                  <CheckCircle2 size={36} className="opacity-90" />
                  <p className="font-medium text-sm">✅ Todos los sistemas operan con normalidad</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {data.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${levelColor[alert.level]}`}
                    >
                      {levelIcon[alert.level]}
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Snapshot grid */}
              <div className="grid grid-cols-2 gap-2 mt-3 border-t border-white/5 pt-3">
                {[
                  { label: 'CPU',     value: `${data.snapshot.cpu.toFixed(1)}%`,  warn: data.snapshot.cpu > 80 },
                  { label: 'RAM',     value: `${data.snapshot.ram.toFixed(1)}%`,  warn: data.snapshot.ram > 85 },
                  { label: 'Disco',   value: `${data.snapshot.disk.toFixed(1)}%`, warn: data.snapshot.disk > 85 },
                  { label: 'Zombies', value: data.snapshot.zombies,               warn: data.snapshot.zombies > 0 },
                  { label: 'Swap',    value: `${data.snapshot.swap.toFixed(1)}%`, warn: data.snapshot.swap > 50 },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={item.warn ? 'text-amber-400 font-semibold' : 'text-slate-200'}>{item.value}</span>
                  </div>
                ))}
                {/* Refresh button filling last cell */}
                <button
                  onClick={fetchHealth}
                  className="bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 flex justify-center items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <RefreshCw size={12} />
                  Refrescar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
function App() {
  const setMetrics = useStore((state) => state.setMetrics);
  const setContainers = useStore((state) => state.setContainers);
  const metrics = useStore(state => state.metrics);
  const [isConnected, setIsConnected] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Calculate live alert count from current metrics (no extra fetch)
  const liveAlertCount = React.useMemo(() => {
    if (!metrics) return 0;
    let count = 0;
    if (metrics.cpu.load > 80)          count++;
    if (metrics.memory.percent > 85)    count++;
    if (metrics.disk.root.percent > 85) count++;
    if (metrics.zombieCount > 0)        count++;
    if (metrics.memory.swapPercent > 50) count++;
    return count;
  }, [metrics]);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('metrics_update', (data) => {
      setMetrics(data);
    });

    socket.on('docker_update', (data) => {
      setContainers(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('metrics_update');
      socket.off('docker_update');
    };
  }, [setMetrics, setContainers]);

  return (
    <Router>
      <div className="flex h-screen bg-background text-slate-200 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 glass-panel m-4 flex flex-col z-10 border-r-0">
          <div className="p-6 flex items-center space-x-3 border-b border-panelBorder">
            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded bg-green-500/30 animate-pulse blur-md"></div>
              <div className="absolute inset-1 rounded bg-green-400/40 animate-ping opacity-50"></div>
              <div className="absolute inset-0 rounded overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-green-400 shadow-[0_0_8px_rgba(74,222,128,1)] animate-bounce"></div>
              </div>
              <div className="relative w-8 h-8 rounded bg-black/90 border border-green-500/50 flex items-center justify-center z-10">
                <Server size={18} className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,1)]" />
              </div>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white truncate">HeroServer<span className="text-green-400 font-light">Status</span></h1>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <NavItem to="/"          icon={<Activity size={20} />}  label="Main Dashboard" />
            <NavItem to="/docker"    icon={<Box size={20} />}       label="Docker Containers" />
            <NavItem to="/services"  icon={<Network size={20} />}   label="Services Map" />
            <NavItem to="/processes" icon={<Cpu size={20} />}       label="Process Explorer" />
            {/* Cloudflare tab — icon changed to generic Cloud */}
            <NavItem to="/cloudflare" icon={<Cloud size={20} />}    label="Cloudflare" />
          </nav>

          <div className="p-4 border-t border-panelBorder text-xs text-slate-400 flex items-center justify-between">
            <span>System Status</span>
            <div className="flex items-center space-x-2">
              <span className={`status-dot ${isConnected ? 'healthy' : 'danger'}`}></span>
              <span>{isConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Topbar */}
          <header className="h-16 flex items-center justify-between px-8 z-10 mt-4 mr-4 glass-panel">
            <h2 className="text-lg font-medium text-slate-300">Unified Server Operations</h2>
            <div className="flex items-center space-x-4">
              {/* 🔔 Alert Bell — now functional */}
              <button
                id="health-alert-btn"
                onClick={() => setShowHealthModal(v => !v)}
                className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Ver alertas del sistema"
              >
                <Bell
                  size={20}
                  className={liveAlertCount > 0 ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}
                />
                {liveAlertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse">
                    {liveAlertCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Health Modal (dropdown style) */}
          {showHealthModal && <HealthModal onClose={() => setShowHealthModal(false)} />}

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-4 z-0">
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/docker"    element={<DockerSection />} />
              <Route path="/services"  element={<ServicesMap />} />
              <Route path="/processes" element={<ProcessExplorer />} />
              <Route path="/cloudflare" element={<Cloudflare />} />
            </Routes>
          </main>

          {/* Background decoration */}
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>
        </div>
      </div>

      {/* Global Toast Container */}
      <ToastContainer />
    </Router>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-accent/20 text-accent border border-accent/30'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default App;
