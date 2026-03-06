import type { Container } from '@modules/container/domain/entities/Container';

export interface CreateContainerInputDTO {
    name: string;
    image: string;
    teamId: string;
    userId: string;
    env?: Array<{ key: string; value: string }>;
    ports?: Array<{ private: number; public: number }>;
    cmd?: string[];
    memory?: number;
    cpus?: number;
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
}

export interface CreateContainerOutputDTO {
    container: Container;
}
