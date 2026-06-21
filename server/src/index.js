"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const system_1 = require("./system");
const docker_1 = require("./docker");
const db_1 = require("./db");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 9091;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static frontend in production
app.use(express_1.default.static(path_1.default.join(__dirname, '../../client/dist')));
// API Routes
app.get('/api/metrics/history', async (req, res) => {
    try {
        const history = await (0, system_1.getHistoricalMetrics)();
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});
app.post('/api/docker/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    try {
        const result = await (0, docker_1.performDockerAction)(id, action);
        res.json({ success: true, result });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../client/dist/index.html'));
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
            (0, system_1.getSystemMetrics)(),
            (0, docker_1.getDockerContainers)()
        ]);
        io.emit('metrics_update', metrics);
        io.emit('docker_update', containers);
    }
    catch (error) {
        console.error('Error emitting updates:', error);
    }
}, 1000);
async function startServer() {
    await (0, db_1.initializeDatabase)();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
startServer();
//# sourceMappingURL=index.js.map