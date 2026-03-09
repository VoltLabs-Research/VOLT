import type {
    ContainerFileEntry,
    ContainerProcessInfo,
    ContainerStats,
    ContainerTerminalAttachment,
    CreateRuntimeContainerOptions,
    RuntimeContainerInfo
} from '@modules/container/domain/port/IContainerService';

export interface RuntimeContainerSummary {
    Id: string;
    State?: string;
    Status?: string;
};

export interface ITeamClusterContainerRuntimeService {
    listContainers(teamClusterId: string): Promise<RuntimeContainerSummary[]>;
    createContainer(teamClusterId: string, config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo>;
    getContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo>;
    startContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo>;
    stopContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo>;
    restartContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo>;
    removeContainer(teamClusterId: string, containerId: string): Promise<void>;
    getStats(teamClusterId: string, containerId: string): Promise<ContainerStats>;
    getFiles(teamClusterId: string, containerId: string, path: string): Promise<ContainerFileEntry[]>;
    readFile(teamClusterId: string, containerId: string, path: string): Promise<string>;
    attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment>;
    getProcesses(teamClusterId: string, containerId: string): Promise<ContainerProcessInfo[]>;
};
