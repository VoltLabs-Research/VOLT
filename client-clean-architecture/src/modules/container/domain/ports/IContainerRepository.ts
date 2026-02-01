import type { Container, ContainerStatsResponse, ContainerFile, RawContainerProcess, EnvVariable, PortMapping } from '../entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export type ContainerAction = 'start' | 'stop' | 'restart';

export interface GetContainersParams {
    page: number;
    limit: number;
    search?: string;
};

export interface CreateContainerParams {
    name: string;
    image: string;
    memory?: number;
    cpus?: number;
    env?: EnvVariable[];
    ports?: PortMapping[];
    cmd?: string[];
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
};

export interface UpdateContainerParams {
    action?: ContainerAction;
    env?: EnvVariable[];
    ports?: PortMapping[];
};

export interface GetFilesParams {
    path?: string;
};

export default interface IContainerRepository {
    getAll(params: GetContainersParams): Promise<PaginatedResponse<Container>>;
    getById(containerId: string): Promise<Container>;
    create(params: CreateContainerParams): Promise<Container>;
    update(containerId: string, params: UpdateContainerParams): Promise<Container>;
    delete(containerId: string): Promise<void>;
    getStats(containerId: string): Promise<ContainerStatsResponse>;
    getProcesses(containerId: string): Promise<RawContainerProcess[]>;
    getFiles(containerId: string, params?: GetFilesParams): Promise<ContainerFile[]>;
    readFile(containerId: string, path: string): Promise<string>;
};
