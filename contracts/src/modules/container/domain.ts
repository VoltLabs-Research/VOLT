import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { TeamCluster } from '../cluster/domain';

export interface EnvVariable{
    key: string;
    value: string;
}

export interface PortMapping{
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

export interface Container extends BaseEntity{
    name: string;
    image: string;
    containerId: string;
    folder: string | null;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team: string;
    teamCluster?: Ref<TeamCluster> | null;
    createdBy: Ref<User>;
    env: EnvVariable[];
    ports: PortMapping[];
    network?: string;
    volume?: string;
    mountDockerSocket?: boolean;
    accessiblePorts?: ContainerAccessiblePort[];
}

export interface ContainerFolder extends BaseEntity{
    title: string;
    parent: string | null;
}

export interface ContainerFile{
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    date: string;
    owner?: string;
    group?: string;
}

export interface ContainerPortAccessUrl{
    url: string;
    expiresAt: string;
    port: ContainerAccessiblePort;
}

export interface ContainerCpuUsage{
    total_usage: number;
}

export interface ContainerCpuStats{
    cpu_usage: ContainerCpuUsage;
    system_cpu_usage: number;
    online_cpus?: number;
}

export interface ContainerMemoryStats{
    usage: number;
    limit: number;
}

export interface ContainerNetworkStats{
    rx_bytes: number;
    tx_bytes: number;
}

export interface ContainerStats{
    cpu_stats: ContainerCpuStats;
    memory_stats: ContainerMemoryStats;
    networks?: Record<string, ContainerNetworkStats>;
}

export interface ContainerMemoryUsageMB{
    used: number;
    total: number;
    free: number;
}

export interface ContainerNetworkTotals{
    rxBytes: number;
    txBytes: number;
}

export interface ContainerStatsResponse{
    stats: ContainerStats;
    memoryMB: ContainerMemoryUsageMB;
    networkTotals: ContainerNetworkTotals;
    limits?: {
        memory: number;
        cpus: number;
    };
}

export interface TeamClusterOption{
    _id: string;
    name: string;
    status: string;
}

export interface CreateContainerResponse{
    container: Container;
}

export interface GetContainerResponse{
    container: Container;
}

export interface UpdateContainerResponse{
    container: Container | null;
    status?: string;
}

export interface GetContainerFilesResponse{
    files: ContainerFile[];
}

export type ContainerProcessInfo = Record<string, unknown>;

export interface GetContainerProcessesResponse{
    processes: ContainerProcessInfo[];
}

export interface ReadContainerFileResponse{
    content: string;
}



export interface ContainerDeployProgressEvent{
    operationId: string;
    teamClusterId: string;
    teamId: string;
    stage: string;
    step?: string;
    image?: string;
    containerName?: string;
    containerId?: string;
    timestamp: string;
}
