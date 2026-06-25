import { useState, useCallback } from 'react';
import { useStore } from '../store';
import { Search, ShieldAlert, Skull, Trash2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { triggerToast } from '../components/Toast';

const getApiUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:9091' : '';

// ─── Confirmation Modal ────────────────────────────────────────────────────────
interface ConfirmModalProps {
  zombie: { pid: number; ppid: number; name: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ zombie, onConfirm, onCancel }: ConfirmModalProps) {
  if (!zombie) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="bg-[#0f0f14] border border-amber-500/30 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(245,158,11,0.15)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-amber-500/5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Skull size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">¿Finalizar proceso padre?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Esta acción es irreversible</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <div className="bg-white/5 rounded-lg p-4 space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Proceso zombie</span>
              <span className="text-red-400 font-medium">{zombie.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PID zombie</span>
              <span className="text-slate-200">{zombie.pid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PPID (padre)</span>
              <span className="text-amber-300">{zombie.ppid > 1 ? zombie.ppid : 'N/A — se usará SIGKILL directo'}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
            <span>
              Se enviará <code className="text-amber-200">SIGHUP</code> al proceso padre (PPID {zombie.ppid}).
              Si el padre no responde, se enviará <code className="text-amber-200">SIGKILL</code> directamente al zombie.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 bg-white/3 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white border border-red-500/40 hover:border-red-500 rounded-lg transition-all flex items-center gap-2"
          >
            <Skull size={14} />
            Matar Padre
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm "Clean All" Modal ─────────────────────────────────────────────────
interface ConfirmAllModalProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmAllModal({ count, onConfirm, onCancel }: ConfirmAllModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="bg-[#0f0f14] border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(239,68,68,0.15)' }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-red-500/5">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Limpiar todos los zombies</h3>
            <p className="text-xs text-slate-400 mt-0.5">{count} proceso(s) serán procesados</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-2 text-xs text-red-300/80 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-400" />
            <span>
              Se enviará <code className="text-red-200">SIGHUP</code> a cada proceso padre involucrado.
              Los padres que no respondan recibirán <code className="text-red-200">SIGKILL</code> directamente.
              Esta acción afecta a <strong>{count}</strong> zombie(s).
            </span>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            🧹 Limpiar todos los Zombies
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProcessExplorer() {
  const metrics = useStore(state => state.metrics);
  const [searchTerm, setSearchTerm] = useState('');

  // Kill regular process state
  const [killingPid, setKillingPid] = useState<number | null>(null);

  // Zombie modals
  const [zombieToClean, setZombieToClean] = useState<{ pid: number; ppid: number; name: string } | null>(null);
  const [showCleanAllModal, setShowCleanAllModal] = useState(false);
  const [cleaningZombie, setCleaningZombie] = useState<number | null>(null);
  const [cleaningAll, setCleaningAll] = useState(false);

  // Refresh metrics from server after action
  const refreshMetrics = useCallback(async () => {
    try {
      // Wait a moment for the OS to reap entries
      await new Promise(r => setTimeout(r, 800));
      // The metrics are pushed via socket; we just wait. But we can force a fetch from history
      // to get updated data. The socket will push fresh data within 1-3 seconds automatically.
    } catch (_) {}
  }, []);

  const handleKillRegular = async (pid: number) => {
    if (!confirm(`¿Matar el proceso ${pid}? Esto puede causar inestabilidad.`)) return;
    setKillingPid(pid);
    try {
      const res = await fetch(`${getApiUrl()}/api/system/process/${pid}/kill`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        triggerToast(data.error || `Error al matar proceso ${pid}`, 'error');
      } else {
        triggerToast(`Proceso ${pid} terminado.`, 'success');
      }
    } catch {
      triggerToast('Error de red al intentar matar el proceso', 'error');
    } finally {
      setKillingPid(null);
    }
  };

  // Single zombie clean — called after modal confirm
  const executeZombieClean = async () => {
    if (!zombieToClean) return;
    const { pid, ppid, name } = zombieToClean;
    setZombieToClean(null);
    setCleaningZombie(pid);
    try {
      const res = await fetch(`${getApiUrl()}/api/system/zombie/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, ppid, name })
      });
      const data = await res.json();
      if (!res.ok) {
        triggerToast(data.error || `No se pudo limpiar el zombie PID ${pid}`, 'error');
      } else {
        const method = data.method === 'SIGHUP'
          ? `SIGHUP al padre PID ${data.target}`
          : `SIGKILL al zombie PID ${data.target}`;
        triggerToast(`✅ Zombie ${name} (${pid}) limpiado — ${method}`, 'success');
        await refreshMetrics();
      }
    } catch {
      triggerToast('Error de red al limpiar el zombie', 'error');
    } finally {
      setCleaningZombie(null);
    }
  };

  // Clean all zombies — called after modal confirm
  const executeCleanAll = async () => {
    if (!metrics) return;
    const zombies = metrics.processes.filter((p: any) => p.state === 'Z' || p.state === 'zombie');
    setShowCleanAllModal(false);
    setCleaningAll(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/system/zombie/clean-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zombies: zombies.map((z: any) => ({ pid: z.pid, ppid: z.ppid, name: z.name })) })
      });
      const data = await res.json();
      if (!res.ok) {
        triggerToast(data.error || 'Error al limpiar zombies', 'error');
      } else {
        const ok = data.results?.filter((r: any) => r.success).length ?? 0;
        const fail = data.results?.filter((r: any) => !r.success).length ?? 0;
        if (fail === 0) {
          triggerToast(`🧹 ${ok} zombie(s) limpiados correctamente`, 'success');
        } else {
          triggerToast(`${ok} limpiados, ${fail} fallaron. Revisa los logs.`, 'warning');
        }
        await refreshMetrics();
      }
    } catch {
      triggerToast('Error de red al limpiar zombies', 'error');
    } finally {
      setCleaningAll(false);
    }
  };

  if (!metrics) return null;

  const allProcesses = metrics.processes as any[];
  const zombies = allProcesses.filter(p => p.state === 'Z' || p.state === 'zombie');
  const zombieCount = zombies.length;

  const filtered = allProcesses.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.pid.toString().includes(searchTerm)
  );

  const isZombie = (p: any) => p.state === 'Z' || p.state === 'zombie';

  return (
    <>
      {/* Modals */}
      <ConfirmModal
        zombie={zombieToClean}
        onConfirm={executeZombieClean}
        onCancel={() => setZombieToClean(null)}
      />
      {showCleanAllModal && (
        <ConfirmAllModal
          count={zombieCount}
          onConfirm={executeCleanAll}
          onCancel={() => setShowCleanAllModal(false)}
        />
      )}

      <div className="glass-panel h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-panelBorder flex flex-wrap gap-3 justify-between items-center bg-white/5">
          <div>
            <h2 className="font-medium text-lg flex items-center gap-2">
              Process Explorer
              {zombieCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full animate-pulse">
                  {zombieCount} zombie{zombieCount > 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Top 50 procesos por uso de CPU</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Clean-all zombie button */}
            {zombieCount > 0 && (
              <button
                onClick={() => setShowCleanAllModal(true)}
                disabled={cleaningAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 hover:border-red-500 rounded-lg transition-all disabled:opacity-50"
                title={`Limpiar los ${zombieCount} zombie(s) detectados`}
              >
                {cleaningAll ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {cleaningAll ? 'Limpiando...' : `🧹 Limpiar ${zombieCount} Zombie${zombieCount > 1 ? 's' : ''}`}
              </button>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Buscar procesos..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-background border border-panelBorder rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-accent text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-black/20 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-4 font-medium">PID</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Usuario</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium text-right">CPU %</th>
                <th className="p-4 font-medium text-right">RAM %</th>
                <th className="p-4 font-medium text-right">Iniciado</th>
                <th className="p-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panelBorder">
              {filtered.map((p: any) => {
                const zombie = isZombie(p);
                return (
                  <tr
                    key={p.pid}
                    className={`hover:bg-white/5 transition-colors ${zombie ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="p-4 text-slate-400 font-mono text-xs">{p.pid}</td>
                    <td className="p-4 font-medium text-slate-200">
                      <span className={zombie ? 'text-red-300' : ''}>{p.name}</span>
                      {zombie && (
                        <span className="ml-2 text-[10px] font-mono text-slate-500">ppid:{p.ppid}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400">{p.user}</td>

                    {/* Estado */}
                    <td className="p-4">
                      {zombie ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          <Skull size={10} />Z
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-white/5 text-slate-400">
                          {p.state || 'S'}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <span className={`px-2 py-1 rounded ${p.cpu > 10 ? 'bg-danger/20 text-danger' : 'bg-white/5 text-slate-300'}`}>
                        {p.cpu.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-300">{p.mem.toFixed(1)}%</td>
                    <td className="p-4 text-right text-slate-400">{p.started}</td>

                    {/* Acción */}
                    <td className="p-4 text-right">
                      {zombie ? (
                        <button
                          onClick={() => setZombieToClean({ pid: p.pid, ppid: p.ppid, name: p.name })}
                          disabled={cleaningZombie === p.pid}
                          className="px-2.5 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 hover:border-red-500 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                          title={`Finalizar padre del zombie ${p.name} (PPID ${p.ppid})`}
                        >
                          {cleaningZombie === p.pid ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Skull size={12} />
                          )}
                          {cleaningZombie === p.pid ? '...' : '🔫 Matar Padre'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleKillRegular(p.pid)}
                          disabled={killingPid === p.pid}
                          className="p-1.5 text-xs bg-danger/10 text-danger hover:bg-danger hover:text-white rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1 ml-auto"
                          title="Kill Process"
                        >
                          <ShieldAlert size={14} />
                          {killingPid === p.pid ? '...' : 'Kill'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Empty state */}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <CheckCircle2 size={32} className="text-emerald-500/50" />
                      <span>No se encontraron procesos.</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* No zombies banner */}
              {zombieCount === 0 && !searchTerm && (
                <tr>
                  <td colSpan={8} className="px-4 py-2 bg-emerald-500/5 border-t border-emerald-500/10">
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 size={13} />
                      ✅ No hay procesos zombie en el sistema
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
