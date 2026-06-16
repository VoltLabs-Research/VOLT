import { useMemo } from 'react';
import { Text } from '@voltstack/bravais';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter,
    ReferenceArea
} from 'recharts';
import { useState, useCallback } from 'react';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';
import { useCanvasPipelineStore } from '../../stores/canvas-pipeline';

interface ExposureChartProps {
    artifact: SceneArtifact;
    rows: ListingRow[];
    pluginId: string;
    analysisId: string;
}

const CHART_COLOR = '#3b82f6';

const detectNumericColumns = (rows: ListingRow[]): string[] => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter((k) => {
        const v = rows[0][k];
        return typeof v === 'number' && k !== '_id' && !k.endsWith('Id');
    });
};

const resolveChartType = (artifact: SceneArtifact): 'line' | 'bar' | 'scatter' => {
    const meta = artifact.metadata ?? {};
    const chartType = meta.chartType as string | undefined;
    if (chartType === 'histogram' || chartType === 'bar') return 'bar';
    if (chartType === 'scatter') return 'scatter';
    return 'line';
};

const ExposureChart = ({ artifact, rows, pluginId: _pluginId, analysisId: _analysisId }: ExposureChartProps) => {
    const addStage = useCanvasPipelineStore((s) => s.addStage);
    const [brushStart, setBrushStart] = useState<number | null>(null);
    const [brushEnd, setBrushEnd] = useState<number | null>(null);
    const [selecting, setSelecting] = useState(false);

    const numericCols = useMemo(() => detectNumericColumns(rows), [rows]);
    const chartType = resolveChartType(artifact);

    const xKey = useMemo(() => {
        const frameKey = numericCols.find((k) => k === 'frame' || k === 'timestep' || k === 'index');
        return frameKey ?? numericCols[0] ?? '';
    }, [numericCols]);

    const yKeys = useMemo(() => numericCols.filter((k) => k !== xKey).slice(0, 4), [numericCols, xKey]);

    const chartData = useMemo(() =>
        rows.map((r) => {
            const entry: Record<string, unknown> = {};
            numericCols.forEach((k) => { entry[k] = r[k]; });
            return entry;
        }),
        [rows, numericCols]
    );

    const handleBrushComplete = useCallback(() => {
        if (brushStart === null || brushEnd === null) return;
        const lo = Math.min(brushStart, brushEnd);
        const hi = Math.max(brushStart, brushEnd);
        addStage('expression-select', {
            expression: xKey ? `${xKey} >= ${lo} && ${xKey} <= ${hi}` : ''
        });
        setBrushStart(null);
        setBrushEnd(null);
        setSelecting(false);
    }, [brushStart, brushEnd, xKey, addStage]);

    if (rows.length === 0 || numericCols.length === 0) {
        return (
            <Text size='xs' tone='muted' style={{ padding: '8px' }}>
                No numeric data available for chart.
            </Text>
        );
    }

    const colors = [CHART_COLOR, '#10b981', '#f59e0b', '#ef4444'];

    const commonProps = {
        data: chartData,
        onMouseDown: (e: { activeLabel?: string | number }) => {
            if (!e?.activeLabel) return;
            setBrushStart(Number(e.activeLabel));
            setSelecting(true);
        },
        onMouseMove: (e: { activeLabel?: string | number }) => {
            if (!selecting || !e?.activeLabel) return;
            setBrushEnd(Number(e.activeLabel));
        },
        onMouseUp: handleBrushComplete
    };

    return (
        <div className="canvas-results-chart" style={{ width: '100%', minWidth: 260 }}>
            <ResponsiveContainer width="100%" height={130}>
                {chartType === 'bar' ? (
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" />
                        <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} width={36} />
                        <Tooltip contentStyle={{ fontSize: 10, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }} />
                        {yKeys.map((k, i) => (
                            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} />
                        ))}
                        {brushStart !== null && brushEnd !== null && (
                            <ReferenceArea x1={Math.min(brushStart, brushEnd)} x2={Math.max(brushStart, brushEnd)} fill={CHART_COLOR} fillOpacity={0.2} />
                        )}
                    </BarChart>
                ) : chartType === 'scatter' && yKeys.length >= 1 ? (
                    <ScatterChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" />
                        <XAxis dataKey={xKey} name={xKey} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                        <YAxis dataKey={yKeys[0]} name={yKeys[0]} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} width={36} />
                        <Tooltip contentStyle={{ fontSize: 10, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }} />
                        <Scatter data={chartData} fill={CHART_COLOR} />
                    </ScatterChart>
                ) : (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" />
                        <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} width={36} />
                        <Tooltip contentStyle={{ fontSize: 10, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-soft)' }} />
                        {yKeys.map((k, i) => (
                            <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} dot={false} strokeWidth={1.5} />
                        ))}
                        {brushStart !== null && brushEnd !== null && (
                            <ReferenceArea x1={Math.min(brushStart, brushEnd)} x2={Math.max(brushStart, brushEnd)} fill={CHART_COLOR} fillOpacity={0.2} />
                        )}
                    </LineChart>
                )}
            </ResponsiveContainer>
            <figcaption>{artifact.displayName}</figcaption>
        </div>
    );
};

export default ExposureChart;
