export declare function getSystemMetrics(): Promise<{
    timestamp: string;
    static: any;
    cpu: {
        load: number;
        temp: number;
    };
    memory: {
        total: any;
        used: any;
        free: any;
        percent: number;
        swapTotal: any;
        swapUsed: any;
    };
    disk: {
        total: any;
        used: any;
        percent: number;
        filesystems: any;
    };
    network: {
        rx_sec: any;
        tx_sec: any;
    };
    loadAverage: any[];
    uptime: number;
    processes: any;
}>;
export { getHistoricalMetrics } from './db';
//# sourceMappingURL=system.d.ts.map