import { useState, useEffect, useMemo } from 'react';
import {
    LineChart,
    Line,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Database } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import { MAX_HISTORY_POINTS, CHART_COLORS } from '@/modules/cluster/domain/constants';
import ChartContainer from '@/modules/cluster/presentation/components/atoms/ChartContainer';
import ChartTooltip from '@/modules/cluster/presentation/components/atoms/ChartTooltip';

interface DataPoint {
    queries: number;
    connections: number;
    latency: number;
    queriesPerSecond?: number;
};

interface DatabasePerformanceProps {
    metrics: ClusterMetrics | null;
};

const DatabasePerformance = ({ metrics }: DatabasePerformanceProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);

    useEffect(() => {
        if(!metrics?.mongodb) return;

        const { queries, connections, latency } = metrics.mongodb;

        setHistory((prev) => {
            const newPoint: DataPoint = { queries, connections, latency };

            if(prev.length){
                const lastQueries = prev[prev.length - 1].queries;
                newPoint.queriesPerSecond = Math.max(0, queries - lastQueries);
            }

            const updated = [...prev, newPoint];
            return updated.length > MAX_HISTORY_POINTS ? updated.slice(1) : updated;
        });
    }, [metrics]);

    const stats = useMemo(() => {
        if(!history.length) return { avgQueries: 0, avgLatency: 0 };

        const withQps = history.filter((d) => d.queriesPerSecond !== undefined);
        const avgQueries = withQps.length
            ? Math.round(withQps.reduce((sum, d) => sum + (d.queriesPerSecond ?? 0), 0) / withQps.length)
            : 0;
        const avgLatency = Math.round(
            history.reduce((sum, d) => sum + d.latency, 0) / history.length
        );

        return { avgQueries, avgLatency };
    }, [history]);

    const renderTooltip = ({ active, payload }: any) => {
        if(!active || !payload?.length || payload.length < 3) return null;

        return (
            <ChartTooltip
                items={[
                    { label: 'Queries', value: payload[0].value, color: CHART_COLORS.blue },
                    { label: 'Connections', value: payload[1].value, color: CHART_COLORS.green },
                    { label: 'Latency', value: `${payload[2].value}ms`, color: CHART_COLORS.orange }
                ]}
            />
        );
    };

    return (
        <ChartContainer
            icon={Database}
            title='MongoDB Performance'
            isLoading={!metrics}
            stats={[
                { label: 'Avg Queries', value: `${stats.avgQueries}/s` },
                { label: 'Avg Latency', value: `${stats.avgLatency}ms` }
            ]}
            statsLoading={!metrics}
        >
            <ResponsiveContainer width='100%' height={280}>
                <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        yAxisId='left'
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        yAxisId='right'
                        orientation='right'
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => `${v}ms`}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='circle'
                    />
                    <Line
                        yAxisId='left'
                        type='monotone'
                        dataKey='queriesPerSecond'
                        stroke={CHART_COLORS.blue}
                        strokeWidth={2}
                        dot={false}
                        name='Queries/s'
                        isAnimationActive={false}
                    />
                    <Line
                        yAxisId='left'
                        type='monotone'
                        dataKey='connections'
                        stroke={CHART_COLORS.green}
                        strokeWidth={2}
                        dot={false}
                        name='Connections'
                        isAnimationActive={false}
                    />
                    <Line
                        yAxisId='right'
                        type='monotone'
                        dataKey='latency'
                        stroke={CHART_COLORS.orange}
                        strokeWidth={2}
                        dot={false}
                        name='Latency(ms)'
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default DatabasePerformance;
