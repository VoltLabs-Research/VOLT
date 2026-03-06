export interface GetContainerStatsInputDTO {
    containerId: string;
}

export interface GetContainerStatsOutputDTO {
    stats: Record<string, unknown>;
    limits: { memory: number; cpus: number };
}
