import type { Container, EnvVariable, PortMapping } from '../../domain/entities';

export interface CreateContainerInputDTO {
    name: string;
    image: string;
    teamId: string;
    memory?: number;
    cpus?: number;
    env?: EnvVariable[];
    ports?: PortMapping[];
    cmd?: string[];
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
};

export interface CreateContainerOutputDTO {
    container: Container;
};
