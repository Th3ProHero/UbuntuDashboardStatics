import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db: any;

export async function initializeDatabase() {
  db = await open({
    filename: path.join(__dirname, '../../database.sqlite'),
    driver: sqlite3.Database
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

export async function saveMetrics(metrics: any) {
  if (!db) return;
  const now = Date.now();
  if (now - lastSaveTime < 60000) return; // Only save every 1 minute
  lastSaveTime = now;

  await db.run(
    'INSERT INTO metrics (timestamp, cpu_load, memory_percent, disk_percent, network_rx, network_tx) VALUES (?, ?, ?, ?, ?, ?)',
    metrics.timestamp,
    metrics.cpu.load,
    metrics.memory.percent,
    metrics.disk.percent,
    metrics.network.rx_sec,
    metrics.network.tx_sec
  );
}

export async function getHistoricalMetrics() {
  if (!db) return [];
  // Get last 60 points
  const rows = await db.all('SELECT * FROM metrics ORDER BY timestamp DESC LIMIT 60');
  return rows.reverse(); // chronological order
}
