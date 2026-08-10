import ChartContainer from '@/shared/ui/components/ChartContainer';
import ChartTooltip from '@/shared/ui/components/ChartTooltip';
import { useMemo } from 'react';
import {
    LineChart,
    Line,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Cpu } from 'lucide-react';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

interface CpuDistributionProps {
    history: ClusterMetrics[];
    metrics: ClusterMetrics | null;
}

interface CpuCoreDataPoint {
    [key: string]: number;
}

const BASE_CORE_COLORS = [
    '#0A84FF', '#30D158', '#FF9F0A', '#FF453A',
    '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F',
    '#AC8E68', '#5E5CE6', '#32D74B', '#FF6482'
];

const CpuDistribution = ({ history, metrics }: CpuDistributionProps) => {
    const chartData = useMemo<CpuCoreDataPoint[]>(() => {
        return history.map((point) => {
            const cores: CpuCoreDataPoint = {};
            point.cpu.coresUsage.forEach((usage, index) => {
                cores[`core${index}`] = usage;
            });
            return cores;
        });
    }, [history]);

    const numCores = useMemo(() => {
        return history.reduce((maxCores, point) => {
            return Math.max(maxCores, point.cpu.coresUsage.length, point.cpu.cores);
        }, metrics?.cpu.cores ?? 0);
    }, [history, metrics?.cpu.cores]);
    const coreColors = useMemo(() => {
        return Array.from({ length: numCores }, (_, i) => BASE_CORE_COLORS[i % BASE_CORE_COLORS.length]);
    }, [numCores]);

    const avgUsage = useMemo(() => {
        if (chartData.length === 0 || numCores === 0) {
            return '0';
        }

        const coreAverages = Array.from({ length: numCores }, (_, coreIndex) => {
            const key = `core${coreIndex}`;
            const values = chartData
                .filter((d) => d[key] !== undefined)
                .map((d) => d[key]);
            if (values.length === 0) return 0;
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        });

        return (coreAverages.reduce((a, b) => a + b, 0) / numCores).toFixed(1);
    }, [chartData, numCores]);

    const hasCoreData = chartData.some((point) => Object.keys(point).length > 0);

    if (!hasCoreData && !metrics) {
        return (
            <ChartContainer icon={Cpu} title='CPU Distribution' isLoading={!metrics}>
                <div className='flex flex-1 items-center justify-center text-sm text-muted'>
                    Waiting for data...
                </div>
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
                {
                    label: 'Avg',
                    value: `${avgUsage}%`,
                    emphasis: 'primary'
                },
                {
                    label: 'Cores',
                    value: numCores,
                    emphasis: 'secondary'
                }
            ]}
            statsLoading={!metrics}
        >
            <ResponsiveContainer width='100%' height={300}>
                <LineChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 0,
                        left: 0,
                        bottom: 0
                    }}
                >
                    <CartesianGrid
                        strokeDasharray='3 3'
                        stroke='var(--color-border-soft)'
                        vertical={false}
                    />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip content={renderTooltip} />
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
                            opacity={0.85}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default CpuDistribution;
