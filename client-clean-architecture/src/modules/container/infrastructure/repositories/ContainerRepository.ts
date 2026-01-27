import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ApiResponse } from '@/shared/types/api';
import type { IContainerRepository } from '../../domain/repositories/IContainerRepository';
import type { GetContainersParams, CreateContainerPayload } from '../../domain/types';
import type { Container, ContainerStats, ContainerProcess } from '../../domain/entities/Container';

export class ContainerRepository extends BaseRepository implements IContainerRepository {
    constructor() {
        super('/container', { useRBAC: true });
    }

    async getContainers(params?: GetContainersParams): Promise<{ data: Container[]; total: number }> {
        const response = await this.client.request<any>('get', '/', { query: params });
        const data = response.data?.data?.containers || [];
        return { data, total: data.length };
    }

    async getContainer(id: string): Promise<Container> {
        const response = await this.client.request<any>('get', `/${id}`);
        return response.data.data.container;
    }

    async createContainer(data: CreateContainerPayload): Promise<Container> {
        return this.post<Container>('/', data);
    }

    async updateContainer(id: string, data: Partial<CreateContainerPayload>): Promise<Container> {
        return this.patch<Container>(`/${id}`, data);
    }

    async deleteContainer(id: string): Promise<void> {
        await this.delete(`/${id}`);
    }

    async controlContainer(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void> {
        await this.updateContainer(id, { action } as any);
    }

    async restartContainer(id: string): Promise<void> {
        await this.updateContainer(id, { action: 'restart' } as any);
    }

    async getStats(id: string): Promise<ContainerStats> {
        const response = await this.client.request<ApiResponse<{ stats: ContainerStats }>>('get', `/${id}/stats`);
        return response.data.data.stats;
    }

    async getProcesses(id: string): Promise<ContainerProcess[]> {
        const response = await this.client.request<ApiResponse<{ processes: ContainerProcess[] }>>('get', `/${id}/processes`);
        return response.data.data.processes;
    }

    async listFiles(containerId: string, path: string): Promise<any> {
        const response = await this.client.request('get', `/${containerId}/files`, { query: { path } });
        return response.data.data;
    }

    async readFile(containerId: string, path: string): Promise<any> {
        const response = await this.client.request('get', `/${containerId}/files/read`, { query: { path } });
        return response.data.data;
    }
}

export const containerRepository = new ContainerRepository();

