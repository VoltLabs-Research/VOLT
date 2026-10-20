import ChartContainer from '@/shared/ui/components/ChartContainer';
import { useMemo } from 'react';
import {
    LineChart,
    Line,
    YAxis,
    CartesianGrid,
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

const CORE_STROKE = 'var(--accent)';
const CORE_OPACITY = 0.28;

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
    const coreKeys = useMemo(() => {
        return Array.from({ length: numCores }, (_, index) => `core${index}`);
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
                        stroke='var(--border)'
                        vertical={false}
                    />
                    <YAxis domain={[0, 100]} hide />
                    {coreKeys.map((coreKey, coreIndex) => (
                        <Line
                            key={coreKey}
                            type='monotone'
                            dataKey={coreKey}
                            stroke={CORE_STROKE}
                            strokeWidth={1}
                            dot={false}
                            activeDot={false}
                            name={`Core ${coreIndex}`}
                            isAnimationActive={false}
                            opacity={CORE_OPACITY}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default CpuDistribution;
