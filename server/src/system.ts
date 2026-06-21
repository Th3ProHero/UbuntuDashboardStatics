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
      used: mem.used,
      free: mem.free,
      percent: parseFloat(((mem.used / mem.total) * 100).toFixed(2)),
      swapTotal: mem.swaptotal,
      swapUsed: mem.swapused
    },
    disk: {
      total: fsSize.reduce((acc, fs) => acc + fs.size, 0),
      used: fsSize.reduce((acc, fs) => acc + fs.used, 0),
      percent: parseFloat((fsSize.reduce((acc, fs) => acc + fs.used, 0) / fsSize.reduce((acc, fs) => acc + fs.size, 0) * 100).toFixed(2)),
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
      started: p.started
    }))
  };

  // Asynchronously save to DB
  saveMetrics(metrics).catch(console.error);

  return metrics;
}

export { getHistoricalMetrics } from './db';
