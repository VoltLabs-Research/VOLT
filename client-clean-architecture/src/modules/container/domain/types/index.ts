import type { ContainerStats, ContainerProcess } from '../entities/Container';

export interface GetContainersParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface CreateContainerPayload {
    name: string;
    image: string;
    team?: string;
    env?: { key: string; value: string }[];
    volumes?: string[];
    ports?: { private: number; public: number }[];
    [key: string]: any;
}

export interface GetContainerStats {
    stats: ContainerStats;
    limits: any;
}

export interface GetContainerProcesses {
    processes: ContainerProcess[];
}
