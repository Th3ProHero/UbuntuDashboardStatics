import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { getSystemMetrics, getHistoricalMetrics } from './system';
import { getDockerContainers, performDockerAction } from './docker';
import { initializeDatabase } from './db';
import { getCloudflareTunnels, getCloudflareZones, getCloudflareDnsRecords } from './cloudflare';
import { spawn } from 'child_process';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 9091;

app.use(cors());
app.use(express.json());

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../../client/dist')));

// API Routes
app.get('/api/metrics/history', async (req, res) => {
  try {
    const history = await getHistoricalMetrics();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/api/docker/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  try {
    const result = await performDockerAction(id, action);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/process/:pid/kill', (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid)) throw new Error('Invalid PID');
    process.kill(pid, 'SIGKILL');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to kill process' });
  }
});

// Clean a zombie process: try kill -HUP on parent first, fallback to kill -9 on zombie pid
app.post('/api/system/zombie/clean', (req, res) => {
  const { pid, ppid, name } = req.body as { pid: number; ppid: number; name: string };

  if (!pid || isNaN(pid)) {
    return res.status(400).json({ error: 'Invalid PID' });
  }

  // Try SIGHUP on parent first (asks parent to reload/reap children)
  if (ppid && ppid > 1) {
    try {
      process.kill(ppid, 'SIGHUP');
      console.log(`[zombie] Sent SIGHUP to parent ${ppid} of zombie ${pid} (${name})`);
      return res.json({ success: true, method: 'SIGHUP', target: ppid });
    } catch (err: any) {
      console.warn(`[zombie] SIGHUP on parent ${ppid} failed: ${err.message}. Falling back to SIGKILL on zombie.`);
    }
  }

  // Fallback: SIGKILL on the zombie itself (may not work for true zombie but cleans up)
  try {
    process.kill(pid, 'SIGKILL');
    console.log(`[zombie] Sent SIGKILL to zombie pid ${pid} (${name})`);
    return res.json({ success: true, method: 'SIGKILL', target: pid });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to clean zombie ${pid}: ${err.message}` });
  }
});

// Clean ALL zombies in one request
app.post('/api/system/zombie/clean-all', async (req, res) => {
  const zombies = req.body.zombies as Array<{ pid: number; ppid: number; name: string }>;

  if (!Array.isArray(zombies) || zombies.length === 0) {
    return res.status(400).json({ error: 'No zombie list provided' });
  }

  const results: any[] = [];

  // Deduplicate by ppid so we only send SIGHUP once per parent
  const processedPpids = new Set<number>();

  for (const z of zombies) {
    if (z.ppid && z.ppid > 1 && !processedPpids.has(z.ppid)) {
      processedPpids.add(z.ppid);
      try {
        process.kill(z.ppid, 'SIGHUP');
        results.push({ pid: z.pid, ppid: z.ppid, method: 'SIGHUP', success: true });
        continue;
      } catch (_) { /* fall through */ }
    }
    // Fallback SIGKILL
    try {
      process.kill(z.pid, 'SIGKILL');
      results.push({ pid: z.pid, method: 'SIGKILL', success: true });
    } catch (err: any) {
      results.push({ pid: z.pid, success: false, error: err.message });
    }
  }

  res.json({ success: true, results });
});

// Health-status endpoint: aggregates real-time alerts from current metrics
app.get('/api/health-status', async (req, res) => {
  try {
    const { getSystemMetrics } = await import('./system');
    const metrics = await getSystemMetrics();
    const alerts: Array<{ level: 'danger' | 'warning' | 'ok'; message: string }> = [];

    if (metrics.cpu.load > 80) {
      alerts.push({ level: 'danger', message: `CPU alta: ${metrics.cpu.load.toFixed(1)}% de uso` });
    }
    if (metrics.memory.percent > 85) {
      alerts.push({ level: 'danger', message: `RAM crítica: ${metrics.memory.percent.toFixed(1)}% utilizada` });
    }
    if (metrics.disk.root.percent > 85) {
      alerts.push({ level: 'warning', message: `Disco raíz al ${metrics.disk.root.percent.toFixed(1)}% de capacidad` });
    }
    if (metrics.disk.root.percent > 95) {
      alerts.push({ level: 'danger', message: `⚠️ Disco raíz CRÍTICO: ${metrics.disk.root.percent.toFixed(1)}%` });
    }
    if (metrics.zombieCount > 0) {
      alerts.push({ level: 'warning', message: `${metrics.zombieCount} proceso(s) zombie detectado(s)` });
    }
    if (metrics.memory.swapPercent > 50) {
      alerts.push({ level: 'warning', message: `Swap elevado: ${metrics.memory.swapPercent.toFixed(1)}% usado` });
    }

    res.json({
      healthy: alerts.length === 0,
      alertCount: alerts.length,
      alerts,
      snapshot: {
        cpu: metrics.cpu.load,
        ram: metrics.memory.percent,
        disk: metrics.disk.root.percent,
        zombies: metrics.zombieCount,
        swap: metrics.memory.swapPercent
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get health status' });
  }
});

app.get('/api/cloudflare/tunnels', async (req, res) => {
  try {
    const tunnels = await getCloudflareTunnels();
    res.json(tunnels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cloudflare/zones', async (req, res) => {
  try {
    const zones = await getCloudflareZones();
    res.json(zones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cloudflare/zones/:zoneId/dns_records', async (req, res) => {
  try {
    const records = await getCloudflareDnsRecords(req.params.zoneId);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('update_server', () => {
    console.log('Server update requested');
    // Using chroot to run apt within the mounted host root
    // Requires privileged container mode
    const updateProcess = spawn('chroot', ['/host/root', 'apt-get', 'update', '&&', 'apt-get', 'upgrade', '-y'], {
      shell: true
    });

    updateProcess.stdout.on('data', (data) => {
      socket.emit('server_update_logs', data.toString());
    });

    updateProcess.stderr.on('data', (data) => {
      socket.emit('server_update_logs', data.toString());
    });

    updateProcess.on('close', (code) => {
      socket.emit('server_update_logs', `\n--- Update process exited with code ${code} ---\n`);
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Emit metrics every second
setInterval(async () => {
  try {
    const [metrics, containers] = await Promise.all([
      getSystemMetrics(),
      getDockerContainers()
    ]);
    
    io.emit('metrics_update', metrics);
    io.emit('docker_update', containers);
  } catch (error) {
    console.error('Error emitting updates:', error);
  }
}, 1000);

async function startServer() {
  await initializeDatabase();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
