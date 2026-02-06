import type { ContainerFile } from '../../domain/entities';

export interface GetContainerFilesInputDTO {
    teamId: string;
    containerId: string;
    path?: string;
};

export interface GetContainerFilesOutputDTO {
    files: ContainerFile[];
};

export interface ReadContainerFileInputDTO {
    teamId: string;
    containerId: string;
    path: string;
};

export interface ReadContainerFileOutputDTO {
    content: string;
};
