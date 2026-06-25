import si from 'systeminformation';
import os from 'os';
import { saveMetrics } from './db';

// Cache static system data so we don't query it every second
let staticSystemData: any = null;

// Cache expensive data
let cachedFsSize: any = null;
let cachedProcesses: any = null;
let lastExpensiveUpdate = 0;

export async function getSystemMetrics() {
  if (!staticSystemData) {
    const [osInfo, system, cpu, memLayout, diskLayout] = await Promise.all([
      si.osInfo(),
      si.system(),
      si.cpu(),
      si.memLayout(),
      si.diskLayout()
    ]);
    staticSystemData = {
      hostname: osInfo.hostname,
      ubuntuVersion: osInfo.distro + ' ' + osInfo.release,
      kernelVersion: osInfo.kernel,
      architecture: osInfo.arch,
      cpuModel: cpu.manufacturer + ' ' + cpu.brand,
      cpuThreads: cpu.cores,
      totalStorage: diskLayout.reduce((acc: any, disk: any) => acc + disk.size, 0)
    };
  }

  const now = Date.now();
  
  if (now - lastExpensiveUpdate > 3000 || !cachedFsSize || !cachedProcesses) {
    const [fsSize, processes] = await Promise.all([
      si.fsSize(),
      si.processes()
    ]);
    cachedFsSize = fsSize;
    cachedProcesses = processes;
    lastExpensiveUpdate = now;
  }

  const [cpuLoad, mem, networkStats] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.networkStats()
  ]);
  const loadAvg = os.loadavg();

  const timestamp = new Date().toISOString();

  const metrics = {
    timestamp,
    static: staticSystemData,
    cpu: {
      load: parseFloat(cpuLoad.currentLoad.toFixed(2)),
      temp: 0
    },
    memory: {
      total: mem.total,
      used: mem.total - (mem.available || mem.free),
      free: mem.available || mem.free,
      percent: parseFloat((((mem.total - (mem.available || mem.free)) / mem.total) * 100).toFixed(2)),
      swapTotal: mem.swaptotal,
      swapUsed: mem.swapused,
      swapPercent: mem.swaptotal > 0 ? parseFloat(((mem.swapused / mem.swaptotal) * 100).toFixed(2)) : 0
    },
    disk: {
      root: {
        total: cachedFsSize.find((fs: any) => fs.mount === '/host/root' || fs.mount === '/')?.size || 0,
        used: cachedFsSize.find((fs: any) => fs.mount === '/host/root' || fs.mount === '/')?.used || 0,
        percent: cachedFsSize.find((fs: any) => fs.mount === '/host/root' || fs.mount === '/')?.use || 0,
      },
      docker: {
        total: cachedFsSize.find((fs: any) => fs.mount === '/')?.size || 0,
        used: cachedFsSize.find((fs: any) => fs.mount === '/')?.used || 0,
        percent: cachedFsSize.find((fs: any) => fs.mount === '/')?.use || 0,
      },
      filesystems: cachedFsSize
    },
    network: {
      rx_sec: networkStats.reduce((acc: any, net: any) => acc + net.rx_sec, 0),
      tx_sec: networkStats.reduce((acc: any, net: any) => acc + net.tx_sec, 0)
    },
    loadAverage: loadAvg,
    uptime: si.time().uptime,
    processes: cachedProcesses.list.slice(0, 50).map((p: any) => ({
      pid: p.pid,
      ppid: p.parentPid ?? p.ppid ?? 0,
      name: p.name,
      cpu: p.cpu,
      mem: p.mem,
      user: p.user,
      started: p.started,
      state: p.state
    })),
    zombieCount: cachedProcesses.list.filter((p: any) => p.state === 'Z' || p.state === 'zombie').length
  };

  // Asynchronously save to DB
  saveMetrics(metrics).catch(console.error);

  return metrics;
}

export { getHistoricalMetrics } from './db';
