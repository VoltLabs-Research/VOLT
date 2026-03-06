export interface ContainerStats {
    read: string;
    precpu_stats: any;
    cpu_stats: any;
    memory_stats: any;
    networks: any;
}

export interface IContainerService {
    createContainer(config: any): Promise<any>;
    startContainer(containerId: string): Promise<void>;
    stopContainer(containerId: string): Promise<void>;
    removeContainer(containerId: string): Promise<void>;
    getStats(containerId: string): Promise<ContainerStats>;
    getFiles(containerId: string, path: string): Promise<any[]>;
    readFile(containerId: string, path: string): Promise<string>;
    writeFile(containerId: string, path: string, content: string): Promise<void>;
    getProcesses(containerId: string): Promise<any[]>;
    getPublishedPort(containerId: string, privatePort: number): Promise<number | null>;
    findAvailableHostPort(start: number, end: number): Promise<number | null>;
    exec(containerId: string, command: string[], stdin?: string): Promise<string>;
    pullImage(imageName: string): Promise<void>;
    ensureImage(imageName: string): Promise<void>;

    createNetwork(name: string): Promise<{ id: string, name: string }>;
    removeNetwork(networkId: string): Promise<void>;
    connectNetwork(networkId: string, containerId: string): Promise<void>;

    createVolume(name: string): Promise<{ id: string, name: string }>;
    removeVolume(name: string): Promise<void>;

    commitContainer(containerId: string, repo: string, tag: string): Promise<void>;
    attachTerminal(containerId: string): Promise<{ stream: any, exec: any }>;
}
