import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import Container from '@/shared/presentation/components/Container';
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
import { Cpu } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

interface CpuDistributionProps {
    history: ClusterMetrics[];
    metrics: ClusterMetrics | null;
};

interface DataPoint {
    [key: string]: number;
};

const BASE_CORE_COLORS = [
    '#0A84FF', '#30D158', '#FF9F0A', '#FF453A',
    '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F',
    '#AC8E68', '#5E5CE6', '#32D74B', '#FF6482'
];

const generateCoreColors = (numCores: number): string[] => (
    Array.from({ length: numCores }, (_, i) => BASE_CORE_COLORS[i % BASE_CORE_COLORS.length])
);

const CpuDistribution = ({ history, metrics }: CpuDistributionProps) => {
    const chartData = useMemo<DataPoint[]>(() => {
        return history.map((point) => {
            const cores: DataPoint = {};
            point.cpu.coresUsage.forEach((usage, index) => {
                cores[`core${index}`] = usage;
            });
            return cores;
        });
    }, [history]);

    const numCores = useMemo(() => {
        return history.reduce((maxCores, point) => {
            return Math.max(maxCores, point.cpu.coresUsage.length, point.cpu.cores || 0);
        }, metrics?.cpu?.cores || 0);
    }, [history, metrics?.cpu?.cores]);
    const coreColors = useMemo(() => generateCoreColors(numCores), [numCores]);

    const stats = useMemo(() => {
        if (chartData.length === 0 || numCores === 0) {
            return {
                avgUsage: '0',
                maxCore: '0',
                minCore: '0'
            };
        }

        const coreAverages = Array.from({ length: numCores }, (_, coreIndex) => {
            const key = `core${coreIndex}`;
            const values = chartData
                .filter((d) => d[key] !== undefined)
                .map((d) => d[key]);
            if (values.length === 0) return 0;
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        });

        return {
            avgUsage: (coreAverages.reduce((a, b) => a + b, 0) / numCores).toFixed(1),
            maxCore: Math.max(...coreAverages).toFixed(1),
            minCore: Math.min(...coreAverages).toFixed(1)
        };
    }, [chartData, numCores]);

    const hasCoreData = chartData.some((point) => Object.keys(point).length > 0);

    if (!hasCoreData && !metrics) {
        return (
            <ChartContainer icon={Cpu} title='CPU Distribution' isLoading={!metrics}>
                <Container className='d-flex flex-center flex-1 font-size-2 color-muted'>
                    Waiting for data...
                </Container>
            </ChartContainer>
        );
    }

    const renderTooltip = ({ active, payload }: Record<string, unknown>) => {
        if (!active || !Array.isArray(payload) || payload.length < 1) return null;

        return (
            <ChartTooltip
                items={payload.map((entry: Record<string, unknown>) => ({
                    label: String(entry.name ?? ''),
                    value: `${Number(entry.value).toFixed(1)}%`,
                    color: String(entry.color ?? '')
                }))}
            />
        );
    };

    return (
        <ChartContainer
            icon={Cpu}
            title='CPU Distribution'
            isLoading={!metrics}
            stats={[
                { label: 'Cores', value: numCores },
                { label: 'Avg', value: `${stats.avgUsage}%` },
                { label: 'Max', value: `${stats.maxCore}%` },
                { label: 'Min', value: `${stats.minCore}%` }
            ]}
            statsLoading={!metrics}
        >
            <ResponsiveContainer width='100%' height={300}>
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
                        domain={[0, 100]}
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='plainline'
                    />
                    {coreColors.map((color, coreIndex) => (
                        <Line
                            key={`core${coreIndex}`}
                            type='monotone'
                            dataKey={`core${coreIndex}`}
                            stroke={color}
                            strokeWidth={1.5}
                            dot={false}
                            name={`Core ${coreIndex}`}
                            isAnimationActive={false}
                            opacity={0.8}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default CpuDistribution;
