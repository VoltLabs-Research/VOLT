import type { Container } from '../../domain/entities';

export interface GetContainersInputDTO {
    teamId: string;
};

export interface GetContainersOutputDTO {
    containers: Container[];
};
