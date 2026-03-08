import type { ContainerFileEntry } from '@modules/container/domain/port/IContainerService';

export interface GetContainerFilesInputDTO {
    teamId: string;
    containerId: string;
    path?: string;
}

export interface GetContainerFilesOutputDTO {
    files: ContainerFileEntry[];
}
