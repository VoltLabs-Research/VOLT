import type { Container, ContainerStats, ContainerProcess } from '../entities/Container';
import type { CreateContainerPayload, GetContainersParams } from '../types';

export interface IContainerRepository {
    getContainers(params?: GetContainersParams): Promise<{ data: Container[]; total: number }>;
    getContainer(id: string): Promise<Container>;
    createContainer(data: CreateContainerPayload): Promise<Container>;
    updateContainer(id: string, data: Partial<CreateContainerPayload>): Promise<Container>;
    deleteContainer(id: string): Promise<void>;
    controlContainer(id: string, action: 'start' | 'stop' | 'pause' | 'unpause'): Promise<void>;
    restartContainer(id: string): Promise<void>;
    getStats(id: string): Promise<ContainerStats>;
    getProcesses(id: string): Promise<ContainerProcess[]>;
    listFiles(containerId: string, path: string): Promise<any>;
    readFile(containerId: string, path: string): Promise<any>;
}
