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
}
