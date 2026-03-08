import type { ContainerProcessInfo } from '@modules/container/domain/port/IContainerService';

export interface GetContainerProcessesInputDTO {
    teamId: string;
    containerId: string;
};

export interface GetContainerProcessesOutputDTO {
    processes: ContainerProcessInfo[];
};
