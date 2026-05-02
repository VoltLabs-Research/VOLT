import type { ContainerFile } from '@/modules/container/api/entities/container-file';

export interface GetContainerFilesInputDTO {
    containerId: string;
    path?: string;
}

export interface GetContainerFilesOutputDTO {
    files: ContainerFile[];
}
