import { useContainerStatsQuery } from './queries';
import { useState, useRef, useEffect } from 'react';
import type { NetworkData } from '@/shared/presentation/components/NetworkChart';
import type { ContainerStatsViewData, CpuData, MemoryData } from '../services/container-stats-view';

interface PreviousCpuStats {
    total: number;
    system: number;
}

interface UseContainerStatsProps {
    containerId: string | undefined;
    isRunning: boolean;
}

const useContainerStats = ({ containerId, isRunning }: UseContainerStatsProps): ContainerStatsViewData => {
    const [cpu, setCpu] = useState<CpuData | null>(null);
    const [memory, setMemory] = useState<MemoryData | null>(null);
    const [network, setNetwork] = useState<NetworkData | null>(null);
    const prevCpuRef = useRef<PreviousCpuStats | null>(null);

    const { data: statsResponse } = useContainerStatsQuery(containerId!, {
        enabled: !!containerId && isRunning,
        refetchInterval: () => {
            return document.hidden ? false : 5000;
        },
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false
    });

    useEffect(() => {
        if(!statsResponse) return;

        const stats = statsResponse.stats;
        const cpuTotal = stats.cpu_stats?.cpu_usage?.total_usage || 0;
        const systemTotal = stats.cpu_stats?.system_cpu_usage || 0;
        const onlineCpus = stats.cpu_stats?.online_cpus || 1;

        if(prevCpuRef.current){
            const cpuDelta = cpuTotal - prevCpuRef.current.total;
            const systemDelta = systemTotal - prevCpuRef.current.system;

            if(systemDelta > 0 && cpuDelta >= 0){
                const cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
                setCpu({ usage: Math.min(100, cpuPercent), cores: onlineCpus });
            }
        }
        prevCpuRef.current = { total: cpuTotal, system: systemTotal };

        setMemory({
            used: statsResponse.memoryMB.used,
            total: statsResponse.memoryMB.total,
            free: statsResponse.memoryMB.free
        });

        setNetwork({ rx: statsResponse.networkTotals.rxBytes, tx: statsResponse.networkTotals.txBytes });
    }, [statsResponse]);

    return {
        cpu,
        memory,
        network
    };
};

export default useContainerStats;
