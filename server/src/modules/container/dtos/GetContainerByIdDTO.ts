import type { Container, ContainerAccessiblePort } from '@modules/container/entities/Container';

export interface GetContainerByIdInputDTO {
    teamId: string;
    containerId: string;
}

export interface GetContainerByIdOutputDTO {
    container: Container;
}

export interface CreateContainerPortAccessUrlInputDTO {
    teamId: string;
    containerId: string;
    privatePort: number;
    userId: string;
}

export interface CreateContainerPortAccessUrlOutputDTO {
    url: string;
    expiresAt: string;
    port: ContainerAccessiblePort;
}
