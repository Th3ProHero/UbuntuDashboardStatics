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
    
    // Attempt to kill process using node's process.kill
    // Signal 9 is SIGKILL
    process.kill(pid, 'SIGKILL');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to kill process' });
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
