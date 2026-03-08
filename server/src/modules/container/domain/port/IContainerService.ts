import type Docker from 'dockerode';

export interface ContainerEnvironmentVariable {
    key: string;
    value: string;
};

export interface ContainerPortMapping {
    private: number;
    public: number;
};

export interface CreateRuntimeContainerOptions {
    image: string;
    name: string;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    memoryInMegabytes: number;
    cpus: number;
    binds?: string[];
    groupAdd?: string[];
    cmd?: string[];
};

export interface ContainerResourceReference {
    id: string;
    name: string;
};

export type ContainerProcessInfo = Record<string, unknown>;

export type ContainerStats = Docker.ContainerStats;
export type RuntimeContainerInfo = Docker.ContainerInspectInfo;

export interface ContainerFileEntry {
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    owner: string;
    group: string;
    date: string;
};

export interface ContainerTerminalSize {
    rows: number;
    cols: number;
};

export interface ContainerTerminalStream {
    destroyed?: boolean;
    write(input: string): void;
    destroy(): void;
    removeAllListeners(event?: string): void;
    on(event: 'data', listener: (chunk: Buffer) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
};

export interface ContainerTerminalExec {
    resize(size: ContainerTerminalSize): Promise<void>;
};

export interface ContainerTerminalAttachment {
    stream: ContainerTerminalStream;
    exec: ContainerTerminalExec;
};

export interface IContainerService {
    createContainer(config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo>;
    startContainer(containerId: string): Promise<void>;
    stopContainer(containerId: string): Promise<void>;
    removeContainer(containerId: string): Promise<void>;
    getStats(containerId: string): Promise<ContainerStats>;
    getFiles(containerId: string, path: string): Promise<ContainerFileEntry[]>;
    readFile(containerId: string, path: string): Promise<string>;
    writeFile(containerId: string, path: string, content: string): Promise<void>;
    getProcesses(containerId: string): Promise<ContainerProcessInfo[]>;
    getPublishedPort(containerId: string, privatePort: number): Promise<number | null>;
    findAvailableHostPort(start: number, end: number): Promise<number | null>;
    resolveDockerSocketGroupAdd(): Promise<string[]>;
    exec(containerId: string, command: string[], stdin?: string): Promise<string>;
    pullImage(imageName: string): Promise<void>;
    ensureImage(imageName: string): Promise<void>;

    createNetwork(name: string): Promise<ContainerResourceReference>;
    removeNetwork(networkId: string): Promise<void>;
    connectNetwork(networkId: string, containerId: string): Promise<void>;

    createVolume(name: string): Promise<ContainerResourceReference>;
    removeVolume(name: string): Promise<void>;

    commitContainer(containerId: string, repo: string, tag: string): Promise<void>;
    attachTerminal(containerId: string): Promise<ContainerTerminalAttachment>;
};
