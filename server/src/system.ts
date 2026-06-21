import si from 'systeminformation';
import os from 'os';
import { saveMetrics } from './db';

// Cache static system data so we don't query it every second
let staticSystemData: any = null;

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
      totalStorage: diskLayout.reduce((acc, disk) => acc + disk.size, 0)
    };
  }

  const [cpuLoad, mem, networkStats, fsSize, processes] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.networkStats(),
    si.fsSize(),
    si.processes()
  ]);
  const loadAvg = os.loadavg();

  const timestamp = new Date().toISOString();

  const metrics = {
    timestamp,
    static: staticSystemData,
    cpu: {
      load: parseFloat(cpuLoad.currentLoad.toFixed(2)),
      temp: 0 // You might need si.cpuTemperature() if supported
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
        total: fsSize.find((fs: any) => fs.mount === '/host/root' || fs.mount === '/')?.size || 0,
        used: fsSize.find((fs: any) => fs.mount === '/host/root' || fs.mount === '/')?.used || 0,
        percent: fsSize.find((fs: any) => fs.mount === '/host/root' || fs.mount === '/')?.use || 0,
      },
      docker: {
        total: fsSize.find((fs: any) => fs.mount === '/')?.size || 0,
        used: fsSize.find((fs: any) => fs.mount === '/')?.used || 0,
        percent: fsSize.find((fs: any) => fs.mount === '/')?.use || 0,
      },
      filesystems: fsSize
    },
    network: {
      rx_sec: networkStats.reduce((acc, net) => acc + net.rx_sec, 0),
      tx_sec: networkStats.reduce((acc, net) => acc + net.tx_sec, 0)
    },
    loadAverage: loadAvg,
    uptime: si.time().uptime,
    processes: processes.list.slice(0, 50).map(p => ({
      pid: p.pid,
      name: p.name,
      cpu: p.cpu,
      mem: p.mem,
      user: p.user,
      started: p.started,
      state: p.state
    })),
    zombieCount: processes.list.filter(p => p.state === 'Z' || p.state === 'zombie').length
  };

  // Asynchronously save to DB
  saveMetrics(metrics).catch(console.error);

  return metrics;
}

export { getHistoricalMetrics } from './db';
