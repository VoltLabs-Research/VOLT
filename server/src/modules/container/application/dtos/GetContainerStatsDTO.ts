import type { ContainerStats } from '@modules/container/domain/port/IContainerService';

export interface GetContainerStatsInputDTO {
    teamId: string;
    containerId: string;
}

export interface GetContainerStatsOutputDTO {
    stats: ContainerStats;
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
