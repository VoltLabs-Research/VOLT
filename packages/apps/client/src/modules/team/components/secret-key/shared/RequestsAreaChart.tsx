import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/modules/team/utils/secret-key/chart-helpers';
import { CHART_AXIS_COLOR, CHART_FONT_SIZE, CHART_GRID_COLOR } from '@/shared/ui/utils/chart-theme';
import type { ContentType } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface RequestsAreaChartDatum {
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
        <AreaChart data={data} margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0
        }}>
            <defs>
                <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor={CHART_COLORS.requests} stopOpacity={0.3} />
                    <stop offset='95%' stopColor={CHART_COLORS.requests} stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke={CHART_GRID_COLOR} />
            <XAxis
                dataKey='date'
                stroke={CHART_AXIS_COLOR}
                style={{ fontSize: CHART_FONT_SIZE }}
                tickLine={xAxisTickLine}
            />
            <YAxis
                stroke={CHART_AXIS_COLOR}
                style={{ fontSize: CHART_FONT_SIZE }}
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
