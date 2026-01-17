import { Readable } from 'stream';

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
    getProcesses(containerId: string): Promise<any[]>;
    exec(containerId: string, command: string[]): Promise<string>;
    pullImage(imageName: string): Promise<void>;
    ensureImage(imageName: string): Promise<void>;

    // Network & Volume operations
    createNetwork(name: string): Promise<{ id: string, name: string }>;
    removeNetwork(networkId: string): Promise<void>;
    connectNetwork(networkId: string, containerId: string): Promise<void>;

    createVolume(name: string): Promise<{ id: string, name: string }>;
    removeVolume(name: string): Promise<void>;

    commitContainer(containerId: string, repo: string, tag: string): Promise<void>;
    attachTerminal(containerId: string): Promise<{ stream: any, exec: any }>;
}
