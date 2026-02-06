import type { Container, EnvVariable, PortMapping } from '../../domain/entities';
import type { ContainerAction } from '../../domain/ports/IContainerRepository';

export interface UpdateContainerInputDTO {
    teamId: string;
    containerId: string;
    action?: ContainerAction;
    env?: EnvVariable[];
    ports?: PortMapping[];
};

export interface UpdateContainerOutputDTO {
    container: Container;
    status?: string;
};
