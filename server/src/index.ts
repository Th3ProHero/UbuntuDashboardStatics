import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { getSystemMetrics, getHistoricalMetrics } from './system';
import { getDockerContainers, performDockerAction } from './docker';
import { initializeDatabase } from './db';
import { getCloudflareTunnels, getCloudflareZones, getCloudflareDnsRecords } from './cloudflare';
import { spawn, execSync, exec } from 'child_process';

// Helper: send a signal via the OS kill binary (works cross-user in privileged containers)
function shellKill(pid: number, signal: string | number): void {
  execSync(`kill -${signal} ${pid}`, { stdio: 'pipe' });
}

// Helper: check if a PID is alive
function pidExists(pid: number): boolean {
  try {
    execSync(`kill -0 ${pid}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

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
    shellKill(pid, 'SIGKILL');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to kill process' });
  }
});

// Diagnostic: get info about a specific PID from the host OS
app.get('/api/system/zombie/info/:pid', (req, res) => {
  const pid = parseInt(req.params.pid, 10);
  if (isNaN(pid)) return res.status(400).json({ error: 'Invalid PID' });
  try {
    const out = execSync(`ps -p ${pid} -o pid,ppid,user,stat,comm --no-headers 2>/dev/null || echo 'NOT_FOUND'`, { stdio: 'pipe' }).toString().trim();
    res.json({ pid, info: out });
  } catch (e: any) {
    res.json({ pid, info: 'NOT_FOUND', error: e.message });
  }
});

// Helper: check if a zombie PID is still alive (in /proc)
function zombieExists(pid: number): boolean {
  try {
    const stat = execSync(`cat /proc/${pid}/status 2>/dev/null | grep -i 'State:' || echo ''`, { stdio: 'pipe' }).toString();
    return stat.trim().length > 0;
  } catch {
    return false;
  }
}

// Helper: sleep ms
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Clean a zombie: verify after each signal, auto-escalate if zombie persists
app.post('/api/system/zombie/clean', async (req: any, res: any) => {
  const { pid, ppid, name } = req.body as { pid: number; ppid: number; name: string };

  if (!pid || isNaN(pid)) {
    return res.status(400).json({ error: 'Invalid PID' });
  }

  console.log(`[zombie] Cleaning pid=${pid} ppid=${ppid} name=${name}`);

  // Step 1: SIGHUP on parent — ask it to reap children
  if (ppid && ppid > 1 && pidExists(ppid)) {
    try {
      shellKill(ppid, 'HUP');
      console.log(`[zombie] SIGHUP → ppid ${ppid}. Waiting to verify...`);
      await sleep(1500);
      if (!zombieExists(pid)) {
        console.log(`[zombie] ✅ Zombie ${pid} gone after SIGHUP`);
        return res.json({ success: true, method: 'SIGHUP', target: ppid });
      }
      console.log(`[zombie] Zombie ${pid} still alive after SIGHUP — escalating to SIGKILL`);
    } catch (err: any) {
      console.warn(`[zombie] SIGHUP on ${ppid} failed: ${err.message}`);
    }
  }

  // Step 2: SIGKILL the parent — forces zombie reparent to init which reaps it
  if (ppid && ppid > 1 && pidExists(ppid)) {
    try {
      shellKill(ppid, '9');
      console.log(`[zombie] SIGKILL → ppid ${ppid}. Waiting to verify...`);
      await sleep(1500);
      if (!zombieExists(pid)) {
        console.log(`[zombie] ✅ Zombie ${pid} gone after SIGKILL on parent`);
        return res.json({ success: true, method: 'SIGKILL_PARENT', target: ppid });
      }
      console.log(`[zombie] Zombie ${pid} still alive after killing parent`);
    } catch (err: any) {
      console.warn(`[zombie] SIGKILL on parent ${ppid} failed: ${err.message}`);
    }
  }

  // Step 3: Last resort — SIGKILL the zombie directly
  try {
    shellKill(pid, '9');
    await sleep(800);
    const stillAlive = zombieExists(pid);
    if (!stillAlive) {
      return res.json({ success: true, method: 'SIGKILL_ZOMBIE', target: pid });
    }
    // Zombie truly reaped only by init — report as partial success
    return res.json({
      success: true,
      method: 'SIGKILL_ZOMBIE',
      target: pid,
      note: 'El zombie persiste en /proc pero será recogido por systemd/init en breve'
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `No se pudo limpiar zombie ${pid}: ${err.message}`,
      hint: ppid && ppid > 1
        ? `Padre PID ${ppid} ${pidExists(ppid) ? 'sigue vivo — puede requerir acceso root al contenedor' : 'ya no existe'}`
        : 'Sin padre válido'
    });
  }
});

// Clean ALL zombies — deduplicate by ppid, verify after kills
app.post('/api/system/zombie/clean-all', async (req: any, res: any) => {
  const zombies = req.body.zombies as Array<{ pid: number; ppid: number; name: string }>;

  if (!Array.isArray(zombies) || zombies.length === 0) {
    return res.status(400).json({ error: 'No zombie list provided' });
  }

  const results: any[] = [];
  const processedPpids = new Set<number>();

  for (const z of zombies) {
    // Try SIGHUP on parent first (once per unique ppid)
    if (z.ppid && z.ppid > 1 && !processedPpids.has(z.ppid) && pidExists(z.ppid)) {
      processedPpids.add(z.ppid);
      try {
        shellKill(z.ppid, 'HUP');
        await sleep(1500);
        if (!zombieExists(z.pid)) {
          results.push({ pid: z.pid, ppid: z.ppid, method: 'SIGHUP', success: true });
          continue;
        }
      } catch (_) { /* escalate */ }

      // SIGHUP didn't work → SIGKILL the parent
      if (pidExists(z.ppid)) {
        try {
          shellKill(z.ppid, '9');
          await sleep(1500);
          if (!zombieExists(z.pid)) {
            results.push({ pid: z.pid, ppid: z.ppid, method: 'SIGKILL_PARENT', success: true });
            continue;
          }
        } catch (_) { /* escalate */ }
      }
    } else if (z.ppid && processedPpids.has(z.ppid)) {
      // Parent already killed for another zombie of same parent — just verify
      await sleep(500);
      if (!zombieExists(z.pid)) {
        results.push({ pid: z.pid, ppid: z.ppid, method: 'REAPED_BY_PARENT_KILL', success: true });
        continue;
      }
    }

    // Last resort: SIGKILL on the zombie itself
    try {
      shellKill(z.pid, '9');
      results.push({ pid: z.pid, method: 'SIGKILL_ZOMBIE', success: true });
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
    // Use exec with a callback so Node.js properly reaps the child process
    // (avoids [spawn-unnamed] zombie accumulation)
    const child = exec(
      'chroot /host/root apt-get update && chroot /host/root apt-get upgrade -y',
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error?.code ?? 0;
        socket.emit('server_update_logs', `\n--- Update process exited with code ${code} ---\n`);
      }
    );

    child.stdout?.on('data', (data: string) => {
      socket.emit('server_update_logs', data.toString());
    });

    child.stderr?.on('data', (data: string) => {
      socket.emit('server_update_logs', data.toString());
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
