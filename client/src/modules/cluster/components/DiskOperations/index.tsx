import { CHART_COLORS } from '@/modules/cluster/utils/chart-colors';
import { CHART_AXIS_COLOR, CHART_FONT_SIZE, CHART_GRID_COLOR } from '@/shared/ui/utils/chart-theme';
import ChartContainer from '@/shared/ui/components/ChartContainer';
import ChartTooltip from '@/shared/ui/components/ChartTooltip';
import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { HardDrive } from 'lucide-react';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

interface DiskOperationsProps {
    history: ClusterMetrics[];
    metrics: ClusterMetrics | null;
}

const DiskOperations = ({ history, metrics }: DiskOperationsProps) => {
    const chartData = useMemo(() => {
        return history
            .filter((point) => point.diskOperations)
            .map((point) => ({
                read: point.diskOperations!.read,
                write: point.diskOperations!.write,
                iops: point.diskOperations!.speed / 10
            }));
    }, [history]);

    const currentThroughput = (metrics?.diskOperations?.read ?? 0) + (metrics?.diskOperations?.write ?? 0);

    const peakThroughput = useMemo(() => {
        if (chartData.length === 0) return 0;
        return chartData.reduce((max, point) => {
            const total = point.read + point.write;
            return total > max ? total : max;
        }, 0);
    }, [chartData]);

    const renderTooltip = ({ active, payload }: Record<string, unknown>) => {
        if (!active || !Array.isArray(payload) || payload.length < 1) return null;

        return (
            <ChartTooltip
                items={payload.map((entry: Record<string, unknown>) => ({
                    label: String(entry.name ?? ''),
                    value: String(entry.value ?? ''),
                    color: String(entry.color ?? '')
                }))}
            />
        );
    };

    return (
        <ChartContainer
            icon={HardDrive}
            title='Disk Operations'
            isLoading={!metrics}
            stats={[
                {
                    label: 'Throughput',
                    value: `${currentThroughput.toFixed(1)} MB/s`,
                    emphasis: 'primary'
                },
                {
                    label: 'Peak',
                    value: `${peakThroughput.toFixed(1)} MB/s`,
                    emphasis: 'secondary'
                }
            ]}
            statsLoading={!metrics}
        >
            <ResponsiveContainer width='100%' height={280}>
                <AreaChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0
                    }}
                >
                    <defs>
                        <linearGradient id='diskReadGradient' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.read} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.read} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='diskWriteGradient' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.write} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.write} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke={CHART_GRID_COLOR} />
                    <YAxis
                        stroke={CHART_AXIS_COLOR}
                        style={{ fontSize: CHART_FONT_SIZE }}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{
                            fontSize: CHART_FONT_SIZE,
                            paddingTop: '20px'
                        }}
                        iconType='circle'
                    />
                    <Area
                        type='monotone'
                        dataKey='read'
                        stroke={CHART_COLORS.read}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#diskReadGradient)'
                        name='Read (MB/s)'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='write'
                        stroke={CHART_COLORS.write}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#diskWriteGradient)'
                        name='Write (MB/s)'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='iops'
                        stroke={CHART_COLORS.iops}
                        strokeWidth={2}
                        fillOpacity={0}
                        fill='none'
                        strokeDasharray='5 5'
                        name='IOPS (x10)'
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default DiskOperations;
