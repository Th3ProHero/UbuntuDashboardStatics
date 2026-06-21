import React, { useState } from 'react';
import { useStore } from '../store';
import { Play, Square, RotateCw, Terminal, Search, CheckCircle, XCircle } from 'lucide-react';

export default function DockerSection() {
  const containers = useStore(state => state.containers);
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<{ id: string, content: string } | null>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch((window.location.hostname === 'localhost' ? 'http://localhost:9091' : '') + `/api/docker/${id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (action === 'logs') {
        setLogs({ id, content: data.result });
      }
    } catch (error) {
      console.error(`Failed to ${action} container ${id}`, error);
    }
  };

  const filtered = containers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const runningCount = containers.filter(c => c.state === 'running').length;
  const stoppedCount = containers.filter(c => c.state === 'exited').length;

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border-t-2 border-t-accent">
          <div className="text-slate-400 text-sm">Total Containers</div>
          <div className="text-2xl font-bold mt-1">{containers.length}</div>
        </div>
        <div className="glass-card p-4 border-t-2 border-t-success">
          <div className="text-slate-400 text-sm">Running</div>
          <div className="text-2xl font-bold mt-1 text-success">{runningCount}</div>
        </div>
        <div className="glass-card p-4 border-t-2 border-t-danger">
          <div className="text-slate-400 text-sm">Stopped</div>
          <div className="text-2xl font-bold mt-1 text-danger">{stoppedCount}</div>
        </div>
        <div className="glass-card p-4 border-t-2 border-t-warning">
          <div className="text-slate-400 text-sm">Unhealthy</div>
          <div className="text-2xl font-bold mt-1 text-warning">0</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel overflow-hidden flex flex-col h-[calc(100vh-280px)]">
        <div className="p-4 border-b border-panelBorder flex justify-between items-center bg-white/5">
          <h2 className="font-medium text-lg">Container Management</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search containers..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-background border border-panelBorder rounded-lg pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:border-accent text-slate-200"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-black/20 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">CPU</th>
                <th className="p-4 font-medium">RAM</th>
                <th className="p-4 font-medium">Network (Rx/Tx)</th>
                <th className="p-4 font-medium">Ports</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panelBorder">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5" title={c.image}>
                      {c.image.length > 30 ? c.image.substring(0, 30) + '...' : c.image}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {c.state === 'running' ? (
                        <CheckCircle size={14} className="text-success" />
                      ) : (
                        <XCircle size={14} className="text-danger" />
                      )}
                      <span className={c.state === 'running' ? 'text-success' : 'text-danger'}>
                        {c.status.split(' ')[0]}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    {c.state === 'running' ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-black/40 rounded overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(c.cpuPercent, 100)}%` }}></div>
                        </div>
                        <span className="text-xs">{c.cpuPercent}%</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    {c.state === 'running' ? formatBytes(c.memoryUsage) : '-'}
                  </td>
                  <td className="p-4 text-slate-400">
                    {c.state === 'running' ? `${formatBytes(c.networkRx)} / ${formatBytes(c.networkTx)}` : '-'}
                  </td>
                  <td className="p-4 text-xs text-slate-400">
                    {c.ports.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {c.ports.slice(0, 2).map((p, i) => <span key={i} className="bg-black/30 px-1.5 py-0.5 rounded">{p}</span>)}
                        {c.ports.length > 2 && <span className="bg-black/30 px-1.5 py-0.5 rounded">+{c.ports.length - 2}</span>}
                      </div>
                    ) : 'None'}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end space-x-1">
                      {c.state !== 'running' && (
                        <button onClick={() => handleAction(c.id, 'start')} className="p-1.5 hover:bg-success/20 hover:text-success rounded transition-colors text-slate-400" title="Start">
                          <Play size={16} />
                        </button>
                      )}
                      {c.state === 'running' && (
                        <button onClick={() => handleAction(c.id, 'stop')} className="p-1.5 hover:bg-danger/20 hover:text-danger rounded transition-colors text-slate-400" title="Stop">
                          <Square size={16} />
                        </button>
                      )}
                      <button onClick={() => handleAction(c.id, 'restart')} className="p-1.5 hover:bg-warning/20 hover:text-warning rounded transition-colors text-slate-400" title="Restart">
                        <RotateCw size={16} />
                      </button>
                      <button onClick={() => handleAction(c.id, 'logs')} className="p-1.5 hover:bg-accent/20 hover:text-accent rounded transition-colors text-slate-400" title="Logs">
                        <Terminal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No containers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Modal */}
      {logs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="p-4 border-b border-panelBorder flex justify-between items-center bg-white/5">
              <h3 className="font-medium flex items-center space-x-2">
                <Terminal size={18} className="text-accent" />
                <span>Container Logs</span>
              </h3>
              <button onClick={() => setLogs(null)} className="text-slate-400 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto bg-[#0a0a0f] font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {logs.content || 'No logs available.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
