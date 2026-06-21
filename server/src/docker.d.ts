export declare function getDockerContainers(): Promise<{
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
}[]>;
export declare function performDockerAction(id: string, action: string): Promise<any>;
//# sourceMappingURL=docker.d.ts.map