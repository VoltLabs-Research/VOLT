import type { Container } from '@modules/container/domain/entities/Container';

export interface GetContainerByIdInputDTO {
    teamId: string;
    containerId: string;
}

export interface GetContainerByIdOutputDTO {
    container: Container;
}
