import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { MetricCard } from '../components/MetricCard';
import { Cpu, MemoryStick, HardDrive, Network, Container, AlertCircle } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function Dashboard() {
  const metrics = useStore(state => state.metrics);
  const containers = useStore(state => state.containers);
  const [history, setHistory] = useState<any[]>([]);

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
          <MetricCard title="ZOMBIES" value={metrics.zombieCount} icon={<AlertCircle size={24} />} colorClass="text-danger" />
        </div>
      </div>

      {/* System Overview */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-medium text-white mb-4">System Overview</h2>
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
    </div>
  );
}
