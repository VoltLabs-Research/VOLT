import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/modules/team/utilities/secret-key/chart-helpers';
import type { ContentType } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export interface RequestsAreaChartDatum {
    date: string;
    count: number;
}

interface RequestsAreaChartProps {
    data: RequestsAreaChartDatum[];
    gradientId: string;
    height: number;
    tooltipContent: ContentType<ValueType, NameType>;
    areaName?: string;
    xAxisTickLine?: boolean;
    yAxisAllowDecimals?: boolean;
}

const RequestsAreaChart = ({
    data,
    gradientId,
    height,
    tooltipContent,
    areaName,
    xAxisTickLine,
    yAxisAllowDecimals
}: RequestsAreaChartProps) => (
    <ResponsiveContainer width='100%' height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
                <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor={CHART_COLORS.requests} stopOpacity={0.3} />
                    <stop offset='95%' stopColor={CHART_COLORS.requests} stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
            <XAxis
                dataKey='date'
                stroke='var(--color-text-muted)'
                style={{ fontSize: '12px' }}
                tickLine={xAxisTickLine}
            />
            <YAxis
                stroke='var(--color-text-muted)'
                style={{ fontSize: '12px' }}
                allowDecimals={yAxisAllowDecimals}
            />
            <Tooltip content={tooltipContent} />
            <Area
                type='monotone'
                dataKey='count'
                stroke={CHART_COLORS.requests}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                name={areaName}
                isAnimationActive={false}
            />
        </AreaChart>
    </ResponsiveContainer>
);

export default RequestsAreaChart;
