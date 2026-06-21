import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { getSystemMetrics, getHistoricalMetrics } from './system';
import { getDockerContainers, performDockerAction } from './docker';
import { initializeDatabase } from './db';

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

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
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
