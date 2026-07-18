import type { ContainerProcessInfo } from '@modules/container/ports/IContainerService';

export interface GetContainerProcessesInputDTO {
    teamId: string;
    containerId: string;
}

export interface GetContainerProcessesOutputDTO {
    processes: ContainerProcessInfo[];
}
