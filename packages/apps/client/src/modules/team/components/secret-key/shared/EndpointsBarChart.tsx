import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/modules/team/utils/secret-key/chart-helpers';
import { CHART_AXIS_COLOR, CHART_FONT_SIZE, CHART_GRID_COLOR } from '@/shared/ui/utils/chart-theme';
import { renderEndpointsBarTooltip } from './chart-tooltip-renderer';

interface EndpointsBarChartDatum {
    endpoint: string;
    count: number;
}

interface EndpointsBarChartProps {
    data: EndpointsBarChartDatum[];
    height: number;
    barName?: string;
    xAxisAllowDecimals?: boolean;
    yAxisTickLine?: boolean;
}

const EndpointsBarChart = ({
    data,
    height,
    barName,
    xAxisAllowDecimals,
    yAxisTickLine
}: EndpointsBarChartProps) => (
    <ResponsiveContainer width='100%' height={height}>
        <BarChart data={data} margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0
        }} layout='vertical'>
            <CartesianGrid strokeDasharray='3 3' stroke={CHART_GRID_COLOR} />
            <XAxis
                type='number'
                stroke={CHART_AXIS_COLOR}
                style={{ fontSize: CHART_FONT_SIZE }}
                allowDecimals={xAxisAllowDecimals}
            />
            <YAxis
                type='category'
                dataKey='endpoint'
                stroke={CHART_AXIS_COLOR}
                style={{ fontSize: CHART_FONT_SIZE }}
                width={150}
                tickLine={yAxisTickLine}
            />
            <Tooltip content={renderEndpointsBarTooltip} />
            <Bar
                dataKey='count'
                fill={CHART_COLORS.endpoints}
                radius={[0, 4, 4, 0]}
                name={barName}
                isAnimationActive={false}
            />
        </BarChart>
    </ResponsiveContainer>
);

export default EndpointsBarChart;
