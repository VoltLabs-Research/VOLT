import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

export const getClusterCpuUsage = (cpu: ClusterMetrics['cpu']): number => {
    if (!cpu.coresUsage.length) {
        return cpu.usage;
    }

    return cpu.coresUsage.reduce((sum, coreUsage) => sum + coreUsage, 0) / cpu.coresUsage.length;
};
