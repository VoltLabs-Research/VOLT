import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { createTooltipRenderer } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import { getStatusCodeClass } from '@/modules/team/utils/secret-key/chart-helpers';
import type { StatusCodeClass } from '@/modules/team/utils/secret-key/chart-helpers';

// A code takes its class's colour; the codes after the first in a class fade toward the canvas.
const CLASS_COLORS: Record<StatusCodeClass, string> = {
    '2xx': 'var(--success)',
    '3xx': 'color-mix(in oklab, var(--foreground) 35%, var(--canvas))',
    '4xx': 'var(--warning)',
    '5xx': 'var(--danger)',
    other: 'var(--muted)'
};

const renderPieTooltip = createTooltipRenderer((payload) => `Status ${payload.statusCode}`, 'Count');

interface StatusCodesPieChartProps {
    data: {
        statusCode: string;
        count: number;
    }[];
}

const colorCodes = (data: StatusCodesPieChartProps['data']) => {
    const seen = new Map<StatusCodeClass, number>();

    return data.map((entry) => {
        const codeClass = getStatusCodeClass(Number(entry.statusCode));
        const rank = seen.get(codeClass) ?? 0;
        seen.set(codeClass, rank + 1);
        const base = CLASS_COLORS[codeClass];

        return {
            ...entry,
            color: rank === 0 ? base : `color-mix(in oklab, ${base} ${Math.max(40, 100 - rank * 30)}%, var(--canvas))`
        };
    });
};

const StatusCodesPieChart = ({ data }: StatusCodesPieChartProps) => {
    const codes = colorCodes(data);
    const total = codes.reduce((sum, entry) => sum + entry.count, 0) || 1;

    return (
        <div className='flex flex-wrap items-center justify-center gap-x-10 gap-y-6'>
            <div className='size-50 shrink-0 max-md:size-40'>
                <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                        <Pie
                            data={codes}
                            dataKey='count'
                            nameKey='statusCode'
                            cx='50%'
                            cy='50%'
                            outerRadius='84%'
                            innerRadius='56%'
                            paddingAngle={1}
                            stroke='none'
                            isAnimationActive={false}
                        >
                            {codes.map((entry) => (
                                <Cell key={entry.statusCode} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={renderPieTooltip} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <dl className='grid grid-cols-[auto_auto_auto] items-center gap-x-4 gap-y-2 text-sm tabular-nums'>
                {codes.map((entry) => (
                    <div className='contents' key={entry.statusCode}>
                        <dt className='inline-flex items-center gap-2 font-mono text-foreground'>
                            <span className='size-2.5 rounded-full' style={{ background: entry.color }} aria-hidden='true' />
                            {entry.statusCode}
                        </dt>
                        <dd className='text-right text-foreground'>{entry.count.toLocaleString()}</dd>
                        <dd className='text-right text-muted'>{`${((entry.count / total) * 100).toFixed(1)}%`}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};

export default StatusCodesPieChart;
