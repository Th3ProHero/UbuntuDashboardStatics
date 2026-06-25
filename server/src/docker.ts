import Docker from 'dockerode';

// Connect to the local Docker daemon
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Cache docker stats to avoid heavy polling every second
const containerStatsCache: Record<string, { stats: any, timestamp: number }> = {};

export async function getDockerContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    
    const now = Date.now();

    const containerDetails = await Promise.all(
      containers.map(async (c) => {
        let stats: any = null;
        if (c.State === 'running') {
          const cached = containerStatsCache[c.Id];
          if (cached && (now - cached.timestamp < 3000)) {
            stats = cached.stats;
          } else {
            try {
              const container = docker.getContainer(c.Id);
              stats = await container.stats({ stream: false });
              containerStatsCache[c.Id] = { stats, timestamp: now };
            } catch (e) {
              // ignore
            }
          }
        }
        
        // Calculate CPU & Memory % (simplified)
        let cpuPercent = 0;
        let memoryUsage = 0;
        let networkRx = 0;
        let networkTx = 0;

        if (stats) {
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
          }
          memoryUsage = stats.memory_stats.usage || 0;
          
          if (stats.networks) {
            const eth0 = stats.networks.eth0 || Object.values(stats.networks)[0] || { rx_bytes: 0, tx_bytes: 0 };
            networkRx = (eth0 as any).rx_bytes;
            networkTx = (eth0 as any).tx_bytes;
          }
        }

        return {
          id: c.Id.substring(0, 12),
          name: c.Names[0].replace('/', ''),
          image: c.Image,
          state: c.State,
          status: c.Status,
          ports: c.Ports.map(p => `${p.PublicPort || ''}:${p.PrivatePort}/${p.Type}`).filter(p => !p.startsWith(':')),
          cpuPercent: parseFloat(cpuPercent.toFixed(2)),
          memoryUsage, // in bytes
          networkRx,
          networkTx,
          created: c.Created
        };
      })
    );
    return containerDetails;
  } catch (error) {
    console.error('Error fetching docker containers:', error);
    return [];
  }
}

export async function performDockerAction(id: string, action: string) {
  const container = docker.getContainer(id);
  switch (action) {
    case 'start':
      return await container.start();
    case 'stop':
      return await container.stop();
    case 'restart':
      return await container.restart();
    case 'logs':
      const logs = await container.logs({ stdout: true, stderr: true, tail: 100 });
      return logs.toString('utf8');
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
