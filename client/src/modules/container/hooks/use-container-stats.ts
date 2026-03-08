import { useState, useRef, useEffect } from 'react';
import { useContainerStatsQuery } from './queries';
import type { NetworkData } from '@/shared/presentation/components/NetworkChart';
import type { ContainerStatsViewData, CpuData, MemoryData } from '../api/entities/container-stats-view';

interface UseContainerStatsProps {
    containerId: string | undefined;
    isRunning: boolean;
    fetchStats?: (id: string) => Promise<any>;
};

const useContainerStats = ({ containerId, isRunning }: UseContainerStatsProps): ContainerStatsViewData => {
    const [cpu, setCpu] = useState<CpuData | null>(null);
    const [memory, setMemory] = useState<MemoryData | null>(null);
    const [network, setNetwork] = useState<NetworkData | null>(null);
    const prevCpuRef = useRef<{ total: number; system: number } | null>(null);

    const { data: statsResponse } = useContainerStatsQuery(containerId!, {
        enabled: !!containerId && isRunning,
        refetchInterval: 2000
    });

    useEffect(() => {
        if(!statsResponse) return;

        const stats = statsResponse.stats;

        // CPU
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

        // Memory
        const usedMB = (stats.memory_stats?.usage || 0) / 1024 / 1024;
        const limitMB = (stats.memory_stats?.limit || 0) / 1024 / 1024;
        setMemory({ used: usedMB, total: limitMB, free: limitMB - usedMB });

        // Network
        const networks = stats.networks || {};
        let rx = 0, tx = 0;
        for(const iface of Object.values(networks)){
            rx += iface.rx_bytes || 0;
            tx += iface.tx_bytes || 0;
        }
        setNetwork({ rx, tx });
    }, [statsResponse]);

    return { cpu, memory, network };
};

export default useContainerStats;
