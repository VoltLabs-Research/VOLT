import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/modules/team/utils/secret-key/chart-helpers';
import { CHART_GRID_COLOR, CHART_TICK } from '@/shared/ui/utils/chart-theme';
import type { ContentType } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface RequestsAreaChartDatum {
    date: string;
    count: number;
}

interface RequestsAreaChartProps {
    data: RequestsAreaChartDatum[];
    height: number;
    tooltipContent: ContentType<ValueType, NameType>;
    areaName?: string;
    yAxisAllowDecimals?: boolean;
}

const RequestsAreaChart = ({
    data,
    height,
    tooltipContent,
    areaName,
    yAxisAllowDecimals
}: RequestsAreaChartProps) => (
    <ResponsiveContainer width='100%' height={height}>
        <AreaChart data={data} margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0
        }}>
            <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
            <XAxis
                dataKey='date'
                tick={CHART_TICK}
                axisLine={false}
                tickLine={false}
            />
            <YAxis
                tick={CHART_TICK}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={yAxisAllowDecimals}
            />
            <Tooltip content={tooltipContent} />
            <Area
                type='monotone'
                dataKey='count'
                stroke={CHART_COLORS.requests}
                strokeWidth={2}
                fill={CHART_COLORS.requests}
                fillOpacity={0.1}
                name={areaName}
                isAnimationActive={false}
            />
        </AreaChart>
    </ResponsiveContainer>
);

export default RequestsAreaChart;
