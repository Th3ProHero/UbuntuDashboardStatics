import { useState } from 'react';
import { useStore } from '../store';
import { Search } from 'lucide-react';

export default function ProcessExplorer() {
  const metrics = useStore(state => state.metrics);
  const [searchTerm, setSearchTerm] = useState('');

  if (!metrics) return null;

  const filtered = metrics.processes.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.pid.toString().includes(searchTerm)
  );

  return (
    <div className="glass-panel h-[calc(100vh-120px)] flex flex-col">
      <div className="p-4 border-b border-panelBorder flex justify-between items-center bg-white/5">
        <div>
          <h2 className="font-medium text-lg">Process Explorer</h2>
          <p className="text-xs text-slate-400 mt-1">Top 50 CPU consuming processes</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search processes..." 
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
              <th className="p-4 font-medium">PID</th>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium text-right">CPU %</th>
              <th className="p-4 font-medium text-right">RAM %</th>
              <th className="p-4 font-medium text-right">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panelBorder">
            {filtered.map((p: any) => (
              <tr key={p.pid} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-slate-400 font-mono text-xs">{p.pid}</td>
                <td className="p-4 font-medium text-slate-200">{p.name}</td>
                <td className="p-4 text-slate-400">{p.user}</td>
                <td className="p-4 text-right">
                  <span className={`px-2 py-1 rounded ${p.cpu > 10 ? 'bg-danger/20 text-danger' : 'bg-white/5 text-slate-300'}`}>
                    {p.cpu.toFixed(1)}%
                  </span>
                </td>
                <td className="p-4 text-right text-slate-300">{p.mem.toFixed(1)}%</td>
                <td className="p-4 text-right text-slate-400">{p.started}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">No processes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
