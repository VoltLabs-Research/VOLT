import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

const SPARKLINE_HEIGHT = 28;
const MIN_DATA_MAX = 1;

const SPARKLINE_DOMAIN: [string, (dataMax: number) => number] = [
    'dataMin',
    (dataMax: number) => Math.max(dataMax, MIN_DATA_MAX)
];

const SPARKLINE_MARGIN = {
    top: 2,
    right: 0,
    left: 0,
    bottom: 0
};

interface SparklinePoint {
    value: number;
}

const toSparklinePoints = (values: number[]): SparklinePoint[] => {
    const points = values
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry))
        .map((value) => ({ value }));

    if (points.length === 1) return [points[0], points[0]];
    if (points.length === 0) return [{ value: 0 }, { value: 0 }];

    return points;
};

interface ResourceSparklineProps {
    values: number[];
    color: string;
}

const ResourceSparkline = ({ values, color }: ResourceSparklineProps) => {
    const fillId = `${useId()}-resource-sparkline`;

    return (
        <div className='pointer-events-none h-7 w-full' aria-hidden='true'>
            <ResponsiveContainer width='100%' height={SPARKLINE_HEIGHT}>
                <AreaChart data={toSparklinePoints(values)} margin={SPARKLINE_MARGIN}>
                    <defs>
                        <linearGradient id={fillId} x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='0%' stopColor={color} stopOpacity={0.16} />
                            <stop offset='100%' stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <YAxis hide domain={SPARKLINE_DOMAIN} />
                    <Area
                        type='monotone'
                        dataKey='value'
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#${fillId})`}
                        fillOpacity={1}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ResourceSparkline;
