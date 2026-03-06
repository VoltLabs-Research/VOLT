import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IContainerRepository from '../../domain/port/IContainerRepository';
import type { GetContainersParams, CreateContainerParams, UpdateContainerParams, GetFilesParams } from '../../domain/port/IContainerRepository';
import type { Container, ContainerStatsResponse, ContainerFile, RawContainerProcess } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

interface ContainerResponse {
    container: Container;
};

interface StatsResponse {
    stats: ContainerStatsResponse['stats'];
    limits: ContainerStatsResponse['limits'];
};

interface ProcessesResponse {
    processes: RawContainerProcess[];
};

interface FilesResponse {
    files: ContainerFile[];
};

interface FileContentResponse {
    content: string;
};

@injectable()
export default class ContainerRepository extends BaseRepository implements IContainerRepository {
    constructor() {
        super('/container', { useRBAC: true });
    }

    async getAll(params: GetContainersParams): Promise<PaginatedResponse<Container>> {
        return this.getAllPaginated('/', params);
    }

    async getById(containerId: string): Promise<Container> {
        const response = await this.client.get<ApiResponse<ContainerResponse>>(`/${containerId}`);
        return this.unwrap(response).container;
    }

    async create(params: CreateContainerParams): Promise<Container> {
        const response = await this.client.post<ApiResponse<ContainerResponse>>('/', params);
        return this.unwrap(response).container;
    }

    async update(containerId: string, params: UpdateContainerParams): Promise<Container> {
        const response = await this.client.patch<ApiResponse<ContainerResponse>>(`/${containerId}`, params);
        return this.unwrap(response).container;
    }

    async delete(containerId: string): Promise<void> {
        await this.client.delete(`/${containerId}`);
    }

    async getStats(containerId: string): Promise<ContainerStatsResponse> {
        const response = await this.client.get<ApiResponse<StatsResponse>>(`/${containerId}/stats`);
        const data = this.unwrap(response);
        return { stats: data.stats, limits: data.limits };
    }

    async getProcesses(containerId: string): Promise<RawContainerProcess[]> {
        const response = await this.client.get<ApiResponse<ProcessesResponse>>(`/${containerId}/processes`);
        return this.unwrap(response).processes;
    }

    async getFiles(containerId: string, params?: GetFilesParams): Promise<ContainerFile[]> {
        const response = await this.client.get<ApiResponse<FilesResponse>>(`/${containerId}/files`, params);
        return this.unwrap(response).files;
    }

    async readFile(containerId: string, path: string): Promise<string> {
        const response = await this.client.get<ApiResponse<FileContentResponse>>(`/${containerId}/files/read`, { path });
        return this.unwrap(response).content;
    }
};
