import type { NetworkData } from '@/shared/presentation/components/NetworkChart';

export interface CpuData {
    usage: number;
    cores: number;
};

export interface MemoryData {
    used: number;
    total: number;
    free?: number;
};

export interface ContainerStatsViewData {
    cpu: CpuData | null;
    memory: MemoryData | null;
    network: NetworkData | null;
};
