import { CHART_COLORS } from '@/modules/cluster/utilities/chart-colors';
import './ResponseTimeChart.css';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
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
import type { ClusterMetrics, ResponseTimes } from '@/modules/cluster/api/entities/cluster-metrics';

interface DataPoint {
    mongodb: number;
    redis: number;
    minio: number;
    self: number;
};

interface ResponseTimeChartProps {
    history: ClusterMetrics[];
    metrics: ClusterMetrics | null;
};

interface ChartLine {
    dataKey: keyof ResponseTimes;
    name: string;
    color: string;
};

const CHART_LINES: ChartLine[] = [
    {
        dataKey: 'mongodb',
        name: 'MongoDB',
        color: CHART_COLORS.mongodb
    },
    {
        dataKey: 'redis',
        name: 'Redis',
        color: CHART_COLORS.redis
    },
    {
        dataKey: 'minio',
        name: 'MinIO',
        color: CHART_COLORS.minio
    },
    {
        dataKey: 'self',
        name: 'Server',
        color: CHART_COLORS.server
    }
];

const renderIcon = () => <div className='response-chart-bar' />;

const ResponseTimeChart = ({ history, metrics }: ResponseTimeChartProps) => {
    const chartData = useMemo<DataPoint[]>(() => {
        return history.map((point) => ({
            mongodb: point.responseTimes.mongodb,
            redis: point.responseTimes.redis,
            minio: point.responseTimes.minio || 0,
            self: point.responseTimes.self
        }));
    }, [history]);

    const stats = useMemo(() => {
        if (!metrics?.responseTimes) {
            return CHART_LINES.map((line) => ({
                label: line.name,
                value: '--'
            }));
        }

        return CHART_LINES.map((line) => ({
            label: line.name,
            value: `${metrics.responseTimes[line.dataKey]?.toFixed(0) ?? '--'}ms`
        }));
    }, [metrics]);

    const renderTooltip = ({ active, payload }: Record<string, unknown>) => {
        if (!active || !Array.isArray(payload) || payload.length < 1) return null;

        return (
            <ChartTooltip
                items={payload.map((entry: Record<string, unknown>) => ({
                    label: String(entry.name ?? ''),
                    value: `${entry.value}ms`,
                    color: String(entry.color ?? '')
                }))}
            />
        );
    };

    return (
        <ChartContainer
            icon={renderIcon}
            title='Response Time'
            isLoading={!metrics}
            stats={stats}
            statsLoading={!metrics}
        >
            <ResponsiveContainer width='100%' height={280}>
                <LineChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0
                    }}
                >
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => `${v}ms`}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='circle'
                    />
                    {CHART_LINES.map((line) => (
                        <Line
                            key={line.dataKey}
                            type='monotone'
                            dataKey={line.dataKey}
                            stroke={line.color}
                            strokeWidth={2}
                            dot={false}
                            name={line.name}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default ResponseTimeChart;
