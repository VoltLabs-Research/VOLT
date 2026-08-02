import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { createTooltipRenderer } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';

const PIE_COLORS = [
    'var(--status-success)',
    'var(--accent-blue)',
    'var(--status-warning)',
    'var(--status-error)',
    'var(--accent-purple)'
];

const renderPieTooltip = createTooltipRenderer((payload) => `Status ${payload.statusCode}`, 'Count');

interface StatusCodesPieChartProps {
    data: {
        statusCode: string;
        count: number;
    }[];
}

const StatusCodesPieChart = ({ data }: StatusCodesPieChartProps) => (
    <ResponsiveContainer width='100%' height={250}>
        <PieChart>
            <Pie
                data={data}
                dataKey='count'
                nameKey='statusCode'
                cx='50%'
                cy='50%'
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                isAnimationActive={false}
            >
                {data.map((entry, index) => (
                    <Cell
                        key={entry.statusCode}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                ))}
            </Pie>
            <Tooltip content={renderPieTooltip} />
        </PieChart>
    </ResponsiveContainer>
);

export default StatusCodesPieChart;
