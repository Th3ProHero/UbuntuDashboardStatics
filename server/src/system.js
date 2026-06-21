"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoricalMetrics = void 0;
exports.getSystemMetrics = getSystemMetrics;
const systeminformation_1 = __importDefault(require("systeminformation"));
const db_1 = require("./db");
// Cache static system data so we don't query it every second
let staticSystemData = null;
async function getSystemMetrics() {
    if (!staticSystemData) {
        const [osInfo, system, cpu, memLayout, diskLayout] = await Promise.all([
            systeminformation_1.default.osInfo(),
            systeminformation_1.default.system(),
            systeminformation_1.default.cpu(),
            systeminformation_1.default.memLayout(),
            systeminformation_1.default.diskLayout()
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
    const [cpuLoad, mem, networkStats, fsSize, loadAvg, processes] = await Promise.all([
        systeminformation_1.default.currentLoad(),
        systeminformation_1.default.mem(),
        systeminformation_1.default.networkStats(),
        systeminformation_1.default.fsSize(),
        systeminformation_1.default.load(),
        systeminformation_1.default.processes()
    ]);
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
        loadAverage: [loadAvg.avg1, loadAvg.avg5, loadAvg.avg15],
        uptime: systeminformation_1.default.time().uptime,
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
    (0, db_1.saveMetrics)(metrics).catch(console.error);
    return metrics;
}
var db_2 = require("./db");
Object.defineProperty(exports, "getHistoricalMetrics", { enumerable: true, get: function () { return db_2.getHistoricalMetrics; } });
//# sourceMappingURL=system.js.map