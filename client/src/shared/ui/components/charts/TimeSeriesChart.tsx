import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceArea,
    ResponsiveContainer
} from 'recharts';
import { useState, useCallback } from 'react';
import { Text } from '@voltstack/bravais';

export interface BrushSelection {
    frameStart: number;
    frameEnd: number;
}

interface TimeSeriesChartProps {
    frames: number[];
    values: number[];
    label?: string;
    onBrush?: (selection: BrushSelection) => void;
}

interface ChartPoint {
    frame: number;
    value: number;
}

const TimeSeriesChart = ({ frames, values, label, onBrush }: TimeSeriesChartProps) => {
    const [brushStart, setBrushStart] = useState<number | null>(null);
    const [brushCurrent, setBrushCurrent] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    const data: ChartPoint[] = frames.map((f, i) => ({
        frame: f,
        value: values[i] ?? 0
    }));

    const handleMouseDown = useCallback((e: { activeLabel?: string | number }) => {
        if (e?.activeLabel === undefined) return;
        const frame = Number(e.activeLabel);
        setBrushStart(frame);
        setBrushCurrent(frame);
        setIsSelecting(true);
    }, []);

    const handleMouseMove = useCallback((e: { activeLabel?: string | number }) => {
        if (!isSelecting || e?.activeLabel === undefined) return;
        setBrushCurrent(Number(e.activeLabel));
    }, [isSelecting]);

    const handleMouseUp = useCallback(() => {
        if (!isSelecting || brushStart === null || brushCurrent === null) {
            setIsSelecting(false);
            return;
        }
        setIsSelecting(false);
        const start = Math.min(brushStart, brushCurrent);
        const end = Math.max(brushStart, brushCurrent);
        if (start !== end && onBrush) {
            onBrush({
                frameStart: start,
                frameEnd: end
            });
        }
        setBrushStart(null);
        setBrushCurrent(null);
    }, [isSelecting, brushStart, brushCurrent, onBrush]);

    const selectionStart = brushStart !== null && brushCurrent !== null
        ? Math.min(brushStart, brushCurrent)
        : null;
    const selectionEnd = brushStart !== null && brushCurrent !== null
        ? Math.max(brushStart, brushCurrent)
        : null;

    if (data.length === 0) {
        return (
            <Text size='xs' tone='muted'>No data available</Text>
        );
    }

    return (
        <div className='time-series-chart' style={{ userSelect: 'none' }}>
            {label && <Text size='xs' tone='muted' className='time-series-chart__label'>{label}</Text>}
            <ResponsiveContainer width='100%' height={120}>
                <LineChart
                    data={data}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    margin={{
                        top: 4,
                        right: 8,
                        bottom: 4,
                        left: 8
                    }}
                >
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.06)' />
                    <XAxis
                        dataKey='frame'
                        tick={{
                            fontSize: 10,
                            fill: 'rgba(255,255,255,0.4)'
                        }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{
                            fontSize: 10,
                            fill: 'rgba(255,255,255,0.4)'
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'var(--color-surface, #1a1a2e)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            fontSize: '11px'
                        }}
                        labelFormatter={(v) => `Frame ${v}`}
                    />
                    <Line
                        type='monotone'
                        dataKey='value'
                        stroke='#3b82f6'
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{
                            r: 3,
                            fill: '#3b82f6'
                        }}
                    />
                    {selectionStart !== null && selectionEnd !== null && (
                        <ReferenceArea
                            x1={selectionStart}
                            x2={selectionEnd}
                            fill='rgba(59,130,246,0.2)'
                            stroke='rgba(59,130,246,0.5)'
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
            {onBrush && (
                <Text size='xs' tone='muted' style={{
                    opacity: 0.5,
                    display: 'block',
                    marginTop: 2
                }}>
                    Drag to select frame range
                </Text>
            )}
        </div>
    );
};

export default TimeSeriesChart;
