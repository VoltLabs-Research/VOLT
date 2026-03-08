import { useMemo } from 'react';
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
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import { CHART_COLORS } from '@/modules/cluster/constants';
import { clusterHistoryQuery } from '@/modules/cluster/hooks/queries';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';

interface DataPoint {
    queries: number;
    connections: number;
    latency: number;
    queriesPerSecond?: number;
}

interface DatabasePerformanceProps {
    clusterId: string;
    metrics: ClusterMetrics | null;
}

const DatabasePerformance = ({ clusterId, metrics }: DatabasePerformanceProps) => {
    const { data: history = [] } = clusterHistoryQuery(clusterId);
    const chartData = useMemo<DataPoint[]>(() => {
        const databaseHistory = history.filter((point) => point.mongodb);

        return databaseHistory.map((point, index) => {
            const previousPoint = index > 0 ? databaseHistory[index - 1].mongodb : undefined;
            const currentPoint = point.mongodb!;

            return {
                queries: currentPoint.queries,
                connections: currentPoint.connections,
                latency: currentPoint.latency,
                queriesPerSecond: previousPoint
                    ? Math.max(0, currentPoint.queries - previousPoint.queries)
                    : undefined
            };
        });
    }, [history]);

    const stats = useMemo(() => {
        if (!chartData.length) return { avgQueries: 0, avgLatency: 0 };

        const withQps = chartData.filter((point) => point.queriesPerSecond !== undefined);
        const avgQueries = withQps.length
            ? Math.round(withQps.reduce((sum, point) => sum + (point.queriesPerSecond ?? 0), 0) / withQps.length)
            : 0;
        const avgLatency = Math.round(
            chartData.reduce((sum, point) => sum + point.latency, 0) / chartData.length
        );

        return { avgQueries, avgLatency };
    }, [chartData]);

    const renderTooltip = ({ active, payload }: Record<string, unknown>) => {
        if (!active || !Array.isArray(payload) || payload.length < 3) return null;

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
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
