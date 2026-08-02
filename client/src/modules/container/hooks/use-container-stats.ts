import { useContainerStatsQuery } from './queries';
import { useState, useRef, useEffect } from 'react';
import type { NetworkData } from '@/shared/ui/components/NetworkChart';
import type { ContainerStatsViewData, CpuData, MemoryData } from '../services/container-stats-view';

interface UseContainerStatsProps {
    containerId: string | undefined;
    isRunning: boolean;
}

/**
 * Latches each polled sample into state: consumers accumulate history from the
 * identity of these objects, so one new object per sample is the contract.
 */
const useContainerStats = ({ containerId, isRunning }: UseContainerStatsProps): ContainerStatsViewData => {
    const [cpu, setCpu] = useState<CpuData | null>(null);
    const [memory, setMemory] = useState<MemoryData | null>(null);
    const [network, setNetwork] = useState<NetworkData | null>(null);
    // CPU percentage is a delta between two samples, so the previous one is kept around.
    const prevCpuRef = useRef<{ total: number; system: number } | null>(null);

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

        const { cpu_stats: cpuStats } = statsResponse.stats;
        const cpuTotal = cpuStats.cpu_usage.total_usage;
        const systemTotal = cpuStats.system_cpu_usage;
        const onlineCpus = cpuStats.online_cpus ?? 1;

        if(prevCpuRef.current){
            const cpuDelta = cpuTotal - prevCpuRef.current.total;
            const systemDelta = systemTotal - prevCpuRef.current.system;

            if(systemDelta > 0 && cpuDelta >= 0){
                setCpu({
                    usage: Math.min(100, (cpuDelta / systemDelta) * onlineCpus * 100),
                    cores: onlineCpus
                });
            }
        }
        prevCpuRef.current = {
            total: cpuTotal,
            system: systemTotal
        };

        setMemory({
            used: statsResponse.memoryMB.used,
            total: statsResponse.memoryMB.total,
            free: statsResponse.memoryMB.free
        });

        setNetwork({
            rx: statsResponse.networkTotals.rxBytes,
            tx: statsResponse.networkTotals.txBytes
        });
    }, [statsResponse]);

    return {
        cpu,
        memory,
        network
    };
};

export default useContainerStats;
