import type { Container } from '@modules/container/domain/entities/Container';
import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

export interface UpdateContainerInputDTO {
    teamId: string;
    containerId: string;
    teamClusterId?: string;
    action?: 'start' | 'stop' | 'restart';
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
};

export interface UpdateContainerOutputDTO {
    container: Container | null;
    status?: string;
};
