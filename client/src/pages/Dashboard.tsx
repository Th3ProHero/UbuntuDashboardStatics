import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { MetricCard } from '../components/MetricCard';
import { Cpu, MemoryStick, HardDrive, Network, Container, AlertCircle, Terminal, X, RefreshCw, Skull, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { io } from 'socket.io-client';
import { triggerToast } from '../components/Toast';

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:9091' : '/');

const getApiUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:9091' : '';

export default function Dashboard() {
  const metrics = useStore(state => state.metrics);
  const containers = useStore(state => state.containers);
  const [history, setHistory] = useState<any[]>([]);

  // Server Update Modal State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Zombie Modal State
  const [showZombieModal, setShowZombieModal] = useState(false);
  const [cleaningPid, setCleaningPid] = useState<number | null>(null);
  const [cleaningAll, setCleaningAll] = useState(false);
  const [confirmZombie, setConfirmZombie] = useState<{ pid: number; ppid: number; name: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const handleCleanZombie = useCallback(async (z: { pid: number; ppid: number; name: string }) => {
    setConfirmZombie(null);
    setCleaningPid(z.pid);
    try {
      const res = await fetch(`${getApiUrl()}/api/system/zombie/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(z)
      });
      const data = await res.json();
      if (!res.ok) {
        triggerToast(data.error || `No se pudo limpiar el zombie PID ${z.pid}`, 'error');
      } else {
        const via = data.method === 'SIGHUP' ? `SIGHUP → padre ${data.target}` : `SIGKILL → PID ${data.target}`;
        triggerToast(`✅ Zombie "${z.name}" (${z.pid}) eliminado — ${via}`, 'success');
      }
    } catch {
      triggerToast('Error de red al limpiar zombie', 'error');
    } finally {
      setCleaningPid(null);
    }
  }, []);

  const handleCleanAll = useCallback(async () => {
    if (!metrics) return;
    setConfirmAll(false);
    setCleaningAll(true);
    const zombies = (metrics.processes as any[]).filter(p => p.state === 'Z' || p.state === 'zombie');
    try {
      const res = await fetch(`${getApiUrl()}/api/system/zombie/clean-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zombies: zombies.map((z: any) => ({ pid: z.pid, ppid: z.ppid, name: z.name })) })
      });
      const data = await res.json();
      if (!res.ok) {
        triggerToast(data.error || 'Error al limpiar todos los zombies', 'error');
      } else {
        const ok = data.results?.filter((r: any) => r.success).length ?? 0;
        const fail = data.results?.filter((r: any) => !r.success).length ?? 0;
        triggerToast(fail === 0 ? `🧹 ${ok} zombie(s) limpiados` : `${ok} ok, ${fail} fallaron`, fail === 0 ? 'success' : 'warning');
      }
    } catch {
      triggerToast('Error de red', 'error');
    } finally {
      setCleaningAll(false);
    }
  }, [metrics]);

  useEffect(() => {
    socket.on('server_update_logs', (data) => {
      setUpdateLogs(prev => [...prev, data]);
    });

    return () => {
      socket.off('server_update_logs');
    };
  }, []);

  const startServerUpdate = () => {
    if (!confirm('Are you sure you want to update the host server? This will run apt update && apt upgrade.')) return;
    setUpdateLogs([]);
    setIsUpdating(true);
    socket.emit('update_server');
  };

  useEffect(() => {
    // Fetch historical data on mount
    fetch((window.location.hostname === 'localhost' ? 'http://localhost:9091' : '') + '/api/metrics/history')
      .then(res => res.json())
      .then(data => setHistory(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Update history array locally for live chart feel
    if (metrics && history.length > 0) {
      setHistory(prev => {
        const newHist = [...prev, {
          timestamp: metrics.timestamp,
          cpu_load: metrics.cpu.load,
          memory_percent: metrics.memory.percent,
          network_rx: metrics.network.rx_sec,
          network_tx: metrics.network.tx_sec
        }];
        if (newHist.length > 60) newHist.shift(); // Keep last 60 points
        return newHist;
      });
    } else if (metrics && history.length === 0) {
      setHistory([{
        timestamp: metrics.timestamp,
        cpu_load: metrics.cpu.load,
        memory_percent: metrics.memory.percent,
        network_rx: metrics.network.rx_sec,
        network_tx: metrics.network.tx_sec
      }]);
    }
  }, [metrics]);

  if (!metrics) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>;
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  // Health Score Logic
  let healthScore = 100;
  if (metrics.cpu.load > 80) healthScore -= 10;
  if (metrics.memory.percent > 85) healthScore -= 10;
  if (metrics.memory.swapPercent > 20) healthScore -= 5;
  if (metrics.zombieCount > 0) healthScore -= (metrics.zombieCount * 2);
  if (metrics.disk.root.percent > 90) healthScore -= 20;
  
  const unhealthyContainers = containers.filter(c => c.state === 'exited' || c.state === 'dead' || c.state === 'restarting').length;
  healthScore -= unhealthyContainers * 5;
  
  if (healthScore < 0) healthScore = 0;

  let healthColor = 'text-success';
  if (healthScore < 80) healthColor = 'text-warning';
  if (healthScore < 50) healthColor = 'text-danger';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 col-span-1 flex flex-col justify-center items-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <h2 className="text-slate-400 font-medium mb-2">Health Score</h2>
          <div className={`text-6xl font-bold ${healthColor} drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]`}>
            {healthScore}
          </div>
          <p className="text-xs text-slate-500 mt-2">Overall System Health</p>
        </div>

        <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="CPU REAL" value={metrics.cpu.load} unit="%" icon={<Cpu size={24} />} colorClass="text-blue-400" />
          <MetricCard title="RAM REAL" value={metrics.memory.percent} unit="%" icon={<MemoryStick size={24} />} colorClass="text-purple-400" />
          <MetricCard title="SWAP" value={metrics.memory.swapPercent} unit="%" icon={<MemoryStick size={24} />} colorClass="text-orange-400" />
          <MetricCard title="ROOT DISK" value={metrics.disk.root.percent} unit="%" icon={<HardDrive size={24} />} colorClass="text-teal-400" />
          
          <MetricCard title="DOCKER DISK" value={metrics.disk.docker.percent} unit="%" icon={<HardDrive size={24} />} colorClass="text-cyan-400" />
          <MetricCard title="NETWORK" value={formatBytes(metrics.network.rx_sec + metrics.network.tx_sec)} unit="/s" icon={<Network size={24} />} colorClass="text-green-400" />
          <MetricCard title="CONTAINERS" value={containers.filter(c => c.state === 'running').length} unit={`/ ${containers.length}`} icon={<Container size={24} />} colorClass="text-blue-500" />
          {/* ZOMBIES — clickable card */}
          <button
            onClick={() => setShowZombieModal(true)}
            className="text-left w-full h-full focus:outline-none group/zcard"
            title="Ver y gestionar procesos zombie"
          >
            <div className={`glass-card p-5 flex flex-col justify-between h-full transition-all duration-200 ${
              metrics.zombieCount > 0
                ? 'border border-red-500/40 hover:border-red-500/80 hover:bg-red-500/5 cursor-pointer'
                : 'border border-white/5 hover:border-white/20 cursor-pointer'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium text-sm">ZOMBIES</h3>
                <div className={`p-2 rounded-lg bg-white/5 text-danger relative`}>
                  <AlertCircle size={24} />
                  {metrics.zombieCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className={`text-3xl font-semibold ${ metrics.zombieCount > 0 ? 'text-red-400' : 'text-white' }`}>
                    {metrics.zombieCount}
                  </span>
                </div>
                {metrics.zombieCount > 0 && (
                  <p className="mt-1 text-[10px] text-red-400/70 group-hover/zcard:text-red-400 transition-colors">
                    Click para gestionar →
                  </p>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-white">System Overview</h2>
          <button 
            onClick={() => setShowUpdateModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded transition-colors text-sm font-medium border border-accent/20 hover:border-accent"
          >
            <Terminal size={16} />
            System Update
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-slate-500 block mb-1">Hostname</span><span className="font-medium text-slate-200">{metrics.static.hostname}</span></div>
          <div><span className="text-slate-500 block mb-1">OS</span><span className="font-medium text-slate-200">{metrics.static.ubuntuVersion}</span></div>
          <div><span className="text-slate-500 block mb-1">Kernel</span><span className="font-medium text-slate-200">{metrics.static.kernelVersion}</span></div>
          <div><span className="text-slate-500 block mb-1">Architecture</span><span className="font-medium text-slate-200">{metrics.static.architecture}</span></div>
          <div><span className="text-slate-500 block mb-1">CPU Model</span><span className="font-medium text-slate-200">{metrics.static.cpuModel}</span></div>
          <div><span className="text-slate-500 block mb-1">CPU Threads</span><span className="font-medium text-slate-200">{metrics.static.cpuThreads}</span></div>
          <div><span className="text-slate-500 block mb-1">Total RAM</span><span className="font-medium text-slate-200">{formatBytes(metrics.memory.total)}</span></div>
          <div><span className="text-slate-500 block mb-1">Root Storage</span><span className="font-medium text-slate-200">{formatBytes(metrics.disk.root.used)} / {formatBytes(metrics.disk.root.total)}</span></div>
        </div>
      </div>

      {/* Live Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 h-80 flex flex-col">
          <h2 className="text-lg font-medium text-white mb-4">CPU & RAM History</h2>
          <div className="flex-1 w-full relative">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 25, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ display: 'none' }}
                />
                <Area type="monotone" dataKey="cpu_load" name="CPU %" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                <Area type="monotone" dataKey="memory_percent" name="RAM %" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 h-80 flex flex-col">
          <h2 className="text-lg font-medium text-white mb-4">Network Traffic</h2>
          <div className="flex-1 w-full relative">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)" 
                  tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} 
                  tickFormatter={(val) => formatBytes(val, 0)} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 25, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ display: 'none' }}
                  formatter={(value: any) => formatBytes(value as number)}
                />
                <Area type="monotone" dataKey="network_rx" name="Download" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRx)" isAnimationActive={false} />
                <Area type="monotone" dataKey="network_tx" name="Upload" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Zombie Management Modal ─────────────────────────────────── */}
      {showZombieModal && metrics && (() => {
        const zombies = (metrics.processes as any[]).filter(p => p.state === 'Z' || p.state === 'zombie');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div
              className="bg-[#0f0f14] border border-panelBorder rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden"
              style={{ boxShadow: '0 0 50px rgba(239,68,68,0.12)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-red-500/5 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <Skull size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">Procesos Zombie</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {zombies.length === 0 ? '✅ No hay zombies activos' : `${zombies.length} proceso(s) en estado Z detectado(s)`}
                  </p>
                </div>
                {zombies.length > 0 && (
                  <button
                    onClick={() => setConfirmAll(true)}
                    disabled={cleaningAll}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cleaningAll
                      ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      : <Trash2 size={13} />}
                    {cleaningAll ? 'Limpiando...' : '🧹 Limpiar Todos'}
                  </button>
                )}
                <button onClick={() => setShowZombieModal(false)} className="text-slate-400 hover:text-white transition-colors ml-1">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto">
                {zombies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-emerald-400">
                    <CheckCircle2 size={40} className="opacity-80" />
                    <p className="font-medium">✅ No hay procesos zombie en el sistema</p>
                    <p className="text-xs text-slate-500">El sistema opera con normalidad</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-black/30 text-slate-400 sticky top-0 text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">PID</th>
                        <th className="px-4 py-3 text-left font-medium">Nombre</th>
                        <th className="px-4 py-3 text-left font-medium">Usuario</th>
                        <th className="px-4 py-3 text-left font-medium">PPID (Padre)</th>
                        <th className="px-4 py-3 text-right font-medium">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {zombies.map((z: any) => (
                        <tr key={z.pid} className="bg-red-500/3 hover:bg-red-500/8 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{z.pid}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-red-300">{z.name}</span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-bold">Z</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{z.user}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-amber-300">{z.ppid > 1 ? z.ppid : '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setConfirmZombie({ pid: z.pid, ppid: z.ppid, name: z.name })}
                              disabled={cleaningPid === z.pid}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 hover:border-red-500 rounded-lg transition-all disabled:opacity-50"
                            >
                              {cleaningPid === z.pid
                                ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                : <Skull size={12} />}
                              {cleaningPid === z.pid ? 'Limpiando...' : '🔫 Matar Padre'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer info */}
              {zombies.length > 0 && (
                <div className="px-5 py-3 border-t border-white/5 bg-white/3 shrink-0">
                  <div className="flex items-start gap-2 text-xs text-amber-300/70">
                    <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Se enviará <code className="text-amber-200">SIGHUP</code> al proceso padre (PPID).
                      Si no responde, se usará <code className="text-amber-200">SIGKILL</code> directamente sobre el zombie.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Individual confirm overlay */}
            {confirmZombie && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
                <div className="bg-[#0f0f14] border border-amber-500/30 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-amber-500/5">
                    <Skull size={16} className="text-amber-400" />
                    <h4 className="font-semibold text-white text-sm">Confirmar acción</h4>
                    <button onClick={() => setConfirmZombie(null)} className="ml-auto text-slate-400 hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div className="bg-white/5 rounded-lg p-3 font-mono text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-slate-400">Zombie</span><span className="text-red-400 font-bold">{confirmZombie.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">PID</span><span className="text-slate-200">{confirmZombie.pid}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">PPID (padre)</span><span className="text-amber-300">{confirmZombie.ppid > 1 ? confirmZombie.ppid : 'N/A'}</span></div>
                    </div>
                    <p className="text-xs text-slate-400">¿Finalizar el proceso padre que dejó huérfano a este zombie?</p>
                  </div>
                  <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
                    <button onClick={() => setConfirmZombie(null)} className="px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors">Cancelar</button>
                    <button
                      onClick={() => handleCleanZombie(confirmZombie)}
                      className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Skull size={13} />🔫 Matar Padre
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Clean-all confirm overlay */}
            {confirmAll && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#0f0f14] border border-red-500/30 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-red-500/5">
                    <Trash2 size={16} className="text-red-400" />
                    <h4 className="font-semibold text-white text-sm">Limpiar todos los zombies</h4>
                    <button onClick={() => setConfirmAll(false)} className="ml-auto text-slate-400 hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-sm text-slate-300 mb-3">Se procesarán <strong className="text-red-400">{zombies.length}</strong> zombie(s) enviando SIGHUP a sus padres.</p>
                    <div className="flex items-start gap-2 text-xs text-red-300/70 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                      <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                      Esta acción es irreversible. Los procesos padre que no respondan al SIGHUP serán eliminados con SIGKILL.
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
                    <button onClick={() => setConfirmAll(false)} className="px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors">Cancelar</button>
                    <button onClick={handleCleanAll} className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-1.5">
                      <Trash2 size={13} />🧹 Confirmar limpieza
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Update Server Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-panelBorder rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-panelBorder flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-2">
                <Terminal size={20} className="text-accent" />
                <h3 className="font-medium text-lg">Host Server Update</h3>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-black/50 flex-1 overflow-auto font-mono text-xs text-slate-300">
              {updateLogs.length === 0 ? (
                <div className="text-slate-500 italic">Ready to run 'apt-get update &amp;&amp; apt-get upgrade -y'...</div>
              ) : (
                <div className="whitespace-pre-wrap">{updateLogs.join('')}</div>
              )}
            </div>

            <div className="p-4 border-t border-panelBorder bg-white/5 flex justify-end gap-3">
              <button 
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 rounded text-slate-300 hover:bg-white/10 transition-colors text-sm"
              >
                Close
              </button>
              <button 
                onClick={startServerUpdate}
                disabled={isUpdating}
                className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {isUpdating ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Start Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
