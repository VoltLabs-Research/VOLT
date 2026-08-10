import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/modules/team/utils/secret-key/chart-helpers';
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
            <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
            <XAxis
                type='number'
                stroke='var(--muted)'
                style={{ fontSize: '12px' }}
                allowDecimals={xAxisAllowDecimals}
            />
            <YAxis
                type='category'
                dataKey='endpoint'
                stroke='var(--muted)'
                style={{ fontSize: '11px' }}
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
