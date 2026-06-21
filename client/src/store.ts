import { create } from 'zustand';

interface SystemMetrics {
  timestamp: string;
  static: {
    hostname: string;
    ubuntuVersion: string;
    kernelVersion: string;
    architecture: string;
    cpuModel: string;
    cpuThreads: number;
    totalStorage: number;
  };
  cpu: {
    load: number;
    temp: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
    swapTotal: number;
    swapUsed: number;
    swapPercent: number;
  };
  disk: {
    root: {
      total: number;
      used: number;
      percent: number;
    };
    docker: {
      total: number;
      used: number;
      percent: number;
    };
    filesystems: any[];
  };
  network: {
    rx_sec: number;
    tx_sec: number;
  };
  loadAverage: number[];
  uptime: number;
  processes: any[];
  zombieCount: number;
}

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
  cpuPercent: number;
  memoryUsage: number;
  networkRx: number;
  networkTx: number;
  created: number;
}

interface StoreState {
  metrics: SystemMetrics | null;
  containers: Container[];
  setMetrics: (metrics: SystemMetrics) => void;
  setContainers: (containers: Container[]) => void;
}

export const useStore = create<StoreState>((set) => ({
  metrics: null,
  containers: [],
  setMetrics: (metrics) => set({ metrics }),
  setContainers: (containers) => set({ containers }),
}));
