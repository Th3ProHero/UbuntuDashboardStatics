"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
exports.saveMetrics = saveMetrics;
exports.getHistoricalMetrics = getHistoricalMetrics;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
let db;
async function initializeDatabase() {
    db = await (0, sqlite_1.open)({
        filename: path_1.default.join(__dirname, '../../database.sqlite'),
        driver: sqlite3_1.default.Database
    });
    await db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      cpu_load REAL,
      memory_percent REAL,
      disk_percent REAL,
      network_rx REAL,
      network_tx REAL
    )
  `);
    // Cleanup old metrics periodically (keep last 24h)
    setInterval(async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await db.run('DELETE FROM metrics WHERE timestamp < ?', yesterday);
    }, 60 * 60 * 1000);
}
// Every minute we save a data point to not overload the DB
let lastSaveTime = 0;
async function saveMetrics(metrics) {
    if (!db)
        return;
    const now = Date.now();
    if (now - lastSaveTime < 60000)
        return; // Only save every 1 minute
    lastSaveTime = now;
    await db.run('INSERT INTO metrics (timestamp, cpu_load, memory_percent, disk_percent, network_rx, network_tx) VALUES (?, ?, ?, ?, ?, ?)', metrics.timestamp, metrics.cpu.load, metrics.memory.percent, metrics.disk.percent, metrics.network.rx_sec, metrics.network.tx_sec);
}
async function getHistoricalMetrics() {
    if (!db)
        return [];
    // Get last 60 points
    const rows = await db.all('SELECT * FROM metrics ORDER BY timestamp DESC LIMIT 60');
    return rows.reverse(); // chronological order
}
//# sourceMappingURL=db.js.map