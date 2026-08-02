import { useEffect, useRef } from 'react';
import useTimeSeriesBuffer from './use-time-series-buffer';
import type { ContainerStatsViewData } from '../services/container-stats-view';

const HISTORY_POINTS = 60;

export interface MetricSeries {
    values: number[];
    peak: number;
    avg: number;
}

const toSeries = (values: number[]): MetricSeries => {
    if (!values.length) {
        return {
            values,
            peak: 0,
            avg: 0
        };
    }

    return {
        values,
        peak: Math.max(...values),
        avg: values.reduce((sum, value) => sum + value, 0) / values.length
    };
};

/**
 * Accumulates a rolling sparkline history from the live stats samples. Network is
 * reported as cumulative counters, so it is charted as the delta between samples.
 */
const useContainerMetricsHistory = (stats: ContainerStatsViewData) => {
    const cpuBuffer = useTimeSeriesBuffer(HISTORY_POINTS);
    const memoryBuffer = useTimeSeriesBuffer(HISTORY_POINTS);
    const networkBuffer = useTimeSeriesBuffer(HISTORY_POINTS);
    const prevNetworkRef = useRef<{ rx: number; tx: number } | null>(null);

    useEffect(() => {
        if (!stats.cpu) return;
        cpuBuffer.pushPoint(stats.cpu.usage);
    }, [stats.cpu, cpuBuffer]);

    useEffect(() => {
        if (!stats.memory) return;
        memoryBuffer.pushPoint(stats.memory.used);
    }, [stats.memory, memoryBuffer]);

    useEffect(() => {
        if (!stats.network) return;
        const previousNetwork = prevNetworkRef.current;

        if (previousNetwork) {
            const deltaRx = Math.max(0, stats.network.rx - previousNetwork.rx);
            const deltaTx = Math.max(0, stats.network.tx - previousNetwork.tx);
            networkBuffer.pushPoint(deltaRx + deltaTx);
        }

        prevNetworkRef.current = {
            rx: stats.network.rx,
            tx: stats.network.tx
        };
    }, [stats.network, networkBuffer]);

    return {
        cpu: toSeries(cpuBuffer.history),
        memory: toSeries(memoryBuffer.history),
        network: toSeries(networkBuffer.history)
    };
};

export default useContainerMetricsHistory;
