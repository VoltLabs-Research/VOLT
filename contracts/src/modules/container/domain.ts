

export interface ContainerEnvironmentVariable{
    key: string;
    value: string;
}

export interface ContainerPortMapping{
    private: number;
    public?: number;
}

export interface ContainerAccessiblePort{
    private: number;
    public?: number;
    protocol: 'tcp';
    browserAccessible: boolean;
    status: 'available' | 'unavailable';
    label?: string;
}

export interface PersistedContainer{
    _id: string;
    name: string;
    image: string;
    containerId: string;
    folder: string | null;
    createdBy: unknown;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team?: unknown;
    teamCluster?: unknown;
    env: ContainerEnvironmentVariable[];
    ports: ContainerPortMapping[];
    mountDockerSocket?: boolean;
    accessiblePorts?: ContainerAccessiblePort[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateContainerResponse{
    container: PersistedContainer;
}

export interface GetContainerResponse{
    container: PersistedContainer;
}

export interface UpdateContainerResponse{
    container: PersistedContainer | null;
    status?: string;
}

export interface CreateContainerPortAccessUrlResponse{
    url: string;
    expiresAt: string;
    port: ContainerAccessiblePort;
}

export interface ContainerFileEntry{
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    owner: string;
    group: string;
    date: string;
}

export interface GetContainerFilesResponse{
    files: ContainerFileEntry[];
}

export type ContainerProcessInfo = Record<string, unknown>;

export interface GetContainerProcessesResponse{
    processes: ContainerProcessInfo[];
}

export interface GetContainerStatsResponse{
    stats: unknown;
    limits: {
        memory: number;
        cpus: number;
    };
    memoryMB: {
        used: number;
        total: number;
        free: number;
    };
    networkTotals: {
        rxBytes: number;
        txBytes: number;
    };
}

export interface ReadContainerFileResponse{
    content: string;
}

export interface ContainerFolder{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}
