import type { ContainerStatsResponse } from '../../domain/entities';

export interface GetContainerStatsInputDTO {
    teamId: string;
    containerId: string;
};

export interface GetContainerStatsOutputDTO extends ContainerStatsResponse {};
