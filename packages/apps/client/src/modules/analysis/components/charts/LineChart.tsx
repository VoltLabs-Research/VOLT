import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface LineChartProps {
    xs: number[];
    values: (number | null)[];
    color: string;
    ariaLabel: string;
    formatX: (value: number) => string;
    formatY: (value: number) => string;
    formatValue: (value: number) => string;
    formatCaption: (index: number) => string;
    mark?: number;
    height?: number;
    zeroBased?: boolean;
    onPick?: (index: number) => void;
}

const MARGIN = { left: 6, right: 52, top: 34, bottom: 24 };

const niceStep = (raw: number): number => {
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
};

const buildTicks = (min: number, max: number, count: number): { domain: [number, number]; ticks: number[] } => {
    let low = min;
    let high = max;
    if (high === low) {
        high = low + (Math.abs(low) || 1);
        low -= (high - low) / 2;
    }
    const step = niceStep((high - low) / count);
    low = Math.floor(low / step) * step;
    high = Math.ceil(high / step) * step;
    const ticks: number[] = [];
    for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Number(tick.toPrecision(12)));
    return { domain: [low, high], ticks };
};

const useElementWidth = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;
        if (!element) return undefined;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width };
};

/* Apple Health's chart: y labels on the trailing edge, hairline grid, the value pinned above the rule. */
const LineChart = ({
    xs,
    values,
    color,
    ariaLabel,
    formatX,
    formatY,
    formatValue,
    formatCaption,
    mark,
    height = 260,
    zeroBased = false,
    onPick
}: LineChartProps) => {
    const gradientId = useId();
    const { ref, width } = useElementWidth();
    const [hover, setHover] = useState<number | null>(null);
    const [labelWidth, setLabelWidth] = useState(0);
    const labelRef = useRef<HTMLDivElement>(null);

    const chart = useMemo(() => {
        if (width === 0 || xs.length < 2) return null;
        const known = values.filter((value): value is number => value !== null);
        if (known.length === 0) return null;

        const y = buildTicks(zeroBased ? Math.min(0, ...known) : Math.min(...known), Math.max(...known), 4);
        const x0 = xs[0];
        const x1 = xs[xs.length - 1];
        const xStep = niceStep(Math.max(1, x1 - x0) / 5);
        const xTicks: number[] = [];
        for (let tick = Math.ceil(x0 / xStep) * xStep; tick <= x1 + 1e-9; tick += xStep) xTicks.push(tick);

        const plotWidth = width - MARGIN.left - MARGIN.right;
        const plotHeight = height - MARGIN.top - MARGIN.bottom;
        const toX = (value: number) => MARGIN.left + ((value - x0) / (x1 - x0 || 1)) * plotWidth;
        const toY = (value: number) => MARGIN.top + (1 - (value - y.domain[0]) / (y.domain[1] - y.domain[0])) * plotHeight;

        // A frame without a value breaks the line and its fill, so a failed frame reads as a gap.
        const bottom = toY(y.domain[0]).toFixed(1);
        let path = '';
        let area = '';
        let run: string[] = [];
        let runStart = 0;
        let runEnd = 0;
        const closeRun = () => {
            if (run.length > 0) area += `M${runStart.toFixed(1)} ${bottom}L${run.join('L')}L${runEnd.toFixed(1)} ${bottom}Z`;
            run = [];
        };
        values.forEach((value, index) => {
            if (value === null) {
                closeRun();
                return;
            }
            const point = `${toX(xs[index]).toFixed(1)} ${toY(value).toFixed(1)}`;
            path += `${run.length > 0 ? 'L' : 'M'}${point}`;
            if (run.length === 0) runStart = toX(xs[index]);
            runEnd = toX(xs[index]);
            run.push(point);
        });
        closeRun();

        return { y, xTicks, toX, toY, path, area, plotWidth, bottom: toY(y.domain[0]) };
    }, [width, height, xs, values, zeroBased]);

    useEffect(() => {
        if (labelRef.current) setLabelWidth(labelRef.current.offsetWidth);
    }, [hover]);

    const indexAt = (clientX: number, target: SVGRectElement): number => {
        if (!chart) return 0;
        const bounds = target.getBoundingClientRect();
        const value = xs[0] + ((clientX - bounds.left) / bounds.width) * (xs[xs.length - 1] - xs[0]);
        let best = 0;
        xs.forEach((x, index) => {
            if (Math.abs(x - value) < Math.abs(xs[best] - value)) best = index;
        });
        return best;
    };

    const hoverValue = hover !== null ? values[hover] : null;
    const hoverX = chart && hover !== null ? chart.toX(xs[hover]) : 0;

    return (
        <div ref={ref} className='relative w-full' style={{ height }}>
            {chart && (
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role='img' aria-label={ariaLabel} className='block overflow-visible'>
                    <defs>
                        <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='0' stopColor={color} stopOpacity={0.24} />
                            <stop offset='1' stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {chart.y.ticks.map((tick) => (
                        <g key={tick}>
                            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={chart.toY(tick)} y2={chart.toY(tick)} className='stroke-foreground/[0.07]' />
                            <text x={width - MARGIN.right + 8} y={chart.toY(tick)} dominantBaseline='middle' className='fill-muted font-mono text-2xs'>{formatY(tick)}</text>
                        </g>
                    ))}
                    {chart.xTicks.map((tick) => (
                        <text key={tick} x={chart.toX(tick)} y={height - 8} textAnchor='middle' className='fill-muted font-mono text-2xs'>{formatX(tick)}</text>
                    ))}
                    {chart.area && <path d={chart.area} fill={`url(#${gradientId})`} />}
                    <path d={chart.path} fill='none' stroke={color} strokeWidth={2} strokeLinejoin='round' strokeLinecap='round' />
                    {mark !== undefined && values[mark] !== null && (
                        <g>
                            <line x1={chart.toX(xs[mark])} x2={chart.toX(xs[mark])} y1={MARGIN.top} y2={chart.bottom} className='stroke-muted' strokeDasharray='2 3' />
                            <circle cx={chart.toX(xs[mark])} cy={chart.toY(values[mark] as number)} r={4} fill={color} className='stroke-background' strokeWidth={2} />
                        </g>
                    )}
                    {hover !== null && (
                        <g>
                            <line x1={hoverX} x2={hoverX} y1={28} y2={chart.bottom} className='stroke-muted/60' />
                            {hoverValue !== null && <circle cx={hoverX} cy={chart.toY(hoverValue)} r={4} fill={color} className='stroke-background' strokeWidth={2} />}
                        </g>
                    )}
                    <rect
                        x={MARGIN.left}
                        y={MARGIN.top}
                        width={chart.plotWidth}
                        height={height - MARGIN.top - MARGIN.bottom}
                        fill='transparent'
                        className={onPick ? 'cursor-pointer' : 'cursor-crosshair'}
                        onPointerMove={(event) => setHover(indexAt(event.clientX, event.currentTarget))}
                        onPointerLeave={() => setHover(null)}
                        onClick={(event) => onPick?.(indexAt(event.clientX, event.currentTarget))}
                    />
                </svg>
            )}
            {chart && hover !== null && (
                <div
                    ref={labelRef}
                    className='pointer-events-none absolute top-0 flex items-baseline gap-1.5 whitespace-nowrap rounded-lg bg-foreground/[0.09] px-2.5 py-1'
                    style={{ left: Math.max(0, Math.min(width - MARGIN.right - labelWidth, hoverX - labelWidth / 2)) }}
                >
                    <span className='text-xs font-semibold tabular-nums text-foreground'>{hoverValue === null ? '—' : formatValue(hoverValue)}</span>
                    <span className='text-2xs text-muted'>{formatCaption(hover)}</span>
                </div>
            )}
        </div>
    );
};

export default LineChart;
