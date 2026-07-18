import type { ContainerFileEntry } from '@modules/container/ports/IContainerService';

export interface GetContainerFilesInputDTO {
    teamId: string;
    containerId: string;
    path?: string;
}

export interface GetContainerFilesOutputDTO {
    files: ContainerFileEntry[];
}
