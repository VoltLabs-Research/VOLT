import { useId, useMemo } from 'react';

interface SparklineProps {
    values: (number | null)[];
    width?: number;
    height?: number;
    className?: string;
}

/* One tint, a soft fill and a dotted line at the first value, so the end reads as above or below the start. */
const Sparkline = ({ values, width = 88, height = 24, className }: SparklineProps) => {
    const gradientId = useId();
    const geometry = useMemo(() => {
        const points = values
            .map((value, index) => (value === null ? null : { index, value }))
            .filter((point): point is { index: number; value: number } => point !== null);
        if (points.length < 2) return null;

        const min = Math.min(...points.map((point) => point.value));
        const max = Math.max(...points.map((point) => point.value));
        const range = max - min || 1;
        const span = Math.max(1, values.length - 1);
        const xy = points.map((point) => [
            (point.index / span) * (width - 2) + 1,
            height - 3 - ((point.value - min) / range) * (height - 6)
        ]);
        const path = xy.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
        const last = xy[xy.length - 1];

        return {
            path,
            area: `${path} L${last[0].toFixed(1)} ${height} L${xy[0][0].toFixed(1)} ${height} Z`,
            baseline: xy[0][1]
        };
    }, [values, width, height]);

    if (!geometry) return null;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden='true' style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0' stopColor='currentColor' stopOpacity={0.2} />
                    <stop offset='1' stopColor='currentColor' stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <line x1={1} x2={width - 1} y1={geometry.baseline} y2={geometry.baseline} stroke='currentColor' strokeOpacity={0.35} strokeDasharray='1 3' strokeLinecap='round' />
            <path d={geometry.path} fill='none' stroke='currentColor' strokeWidth={1.6} strokeLinejoin='round' strokeLinecap='round' />
        </svg>
    );
};

export default Sparkline;
