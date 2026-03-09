import type { Container } from '@modules/container/domain/entities/Container';
import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

export interface CreateContainerInputDTO {
    name: string;
    image: string;
    teamId: string;
    teamClusterId?: string;
    userId: string;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    cmd?: string[];
    memory?: number;
    cpus?: number;
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
};

export interface CreateContainerOutputDTO {
    container: Container;
};
