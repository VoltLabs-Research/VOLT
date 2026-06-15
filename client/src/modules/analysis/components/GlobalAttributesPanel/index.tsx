import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Button, Row, Stack, Surface, Text } from '@voltstack/bravais';
import { ChevronDown, ChevronRight, Download, BarChart2 } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceArea
} from 'recharts';
import { useGlobalAttributesMetadata, useGlobalAttributesTimeSeries } from '../../hooks/use-global-attributes';
import { exportGlobalAttributesCsv } from '../../hooks/use-export-global-attributes';
import { useCanvasPipelineStore } from '@/modules/canvas/stores/canvas-pipeline';
import { useGlobalAttributesStore } from '../../stores/global-attributes.store';

interface GlobalAttributesPanelProps {
    analysisId: string | undefined;
}

const CHART_COLOR = '#3b82f6';

const GlobalAttributesPanel = memo(({ analysisId }: GlobalAttributesPanelProps) => {
    const [collapsed, setCollapsed] = useState(true);
    const [selectedAttr, setSelectedAttr] = useState<string | undefined>(undefined);
    const consumePendingOpen = useGlobalAttributesStore((s) => s.consumePendingOpen);

    useEffect(() => {
        const attr = consumePendingOpen();
        if (attr) {
            setCollapsed(false);
            setSelectedAttr(attr);
        }
    });
    const [exporting, setExporting] = useState(false);

    const { data: metadata, isLoading: metaLoading } = useGlobalAttributesMetadata(analysisId);
    const activeAttr = selectedAttr ?? metadata?.[0]?.name;
    const { data: timeSeries, isLoading: tsLoading } = useGlobalAttributesTimeSeries(
        analysisId,
        activeAttr
    );

    const addStage = useCanvasPipelineStore((s) => s.addStage);

    const [brushStart, setBrushStart] = useState<number | null>(null);
    const [brushEnd, setBrushEnd] = useState<number | null>(null);
    const [selecting, setSelecting] = useState(false);

    const chartData = useMemo(() => {
        if (!timeSeries?.frames) return [];
        return timeSeries.frames.map((f, i) => ({ frame: f, value: timeSeries.values[i] }));
    }, [timeSeries]);

    const handleBrushComplete = useCallback(() => {
        if (brushStart === null || brushEnd === null) return;
        const lo = Math.min(brushStart, brushEnd);
        const hi = Math.max(brushStart, brushEnd);
        addStage('expression-select', { expression: `frame >= ${lo} && frame <= ${hi}` });
        setBrushStart(null);
        setBrushEnd(null);
        setSelecting(false);
    }, [brushStart, brushEnd, addStage]);

    const handleExport = useCallback(async () => {
        if (!analysisId) return;
        setExporting(true);
        try {
            await exportGlobalAttributesCsv(analysisId);
        } finally {
            setExporting(false);
        }
    }, [analysisId]);

    if (!analysisId) return null;

    return (
        <Surface
            variant='glass'
            display='flex'
            direction='column'
            position='absolute'
            overflow='hidden'
            style={{ left: '1rem', bottom: '3.5rem', maxWidth: 300, zIndex: 200 }}
        >
            <Row
                gap='05'
                className='canvas-results-header panel-header-bordered'
            >
                <button
                    type='button'
                    onClick={() => setCollapsed((c) => !c)}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? 'Expand Global Attributes' : 'Collapse Global Attributes'}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                >
                    <BarChart2 size={12} aria-hidden='true' />
                    <Text size='sm' tone='secondary' style={{ margin: '0 2px' }}>
                        Global Attributes
                    </Text>
                    {collapsed
                        ? <ChevronRight size={12} aria-hidden='true' />
                        : <ChevronDown size={12} aria-hidden='true' />
                    }
                </button>
                {!collapsed && analysisId && (
                    <button
                        type='button'
                        onClick={handleExport}
                        disabled={exporting}
                        aria-label='Export as CSV'
                        title='Export as CSV'
                        style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}
                    >
                        <Download size={12} aria-hidden='true' />
                    </button>
                )}
            </Row>

            {!collapsed && (
                <Box overflow='auto' className="canvas-results-content">
                    {metaLoading && (
                        <Text size='xs' tone='muted'>Loading attributes...</Text>
                    )}
                    {!metaLoading && (!metadata || metadata.length === 0) && (
                        <Text size='xs' tone='muted'>No global attributes available.</Text>
                    )}
                    {metadata && metadata.length > 0 && (
                        <Stack gap='05'>
                            <Row overflow='auto' style={{ gap: 4, flexWrap: 'wrap' }}>
                                {metadata.map((attr) => (
                                    <Button
                                        key={attr.name}
                                        variant={activeAttr === attr.name ? 'solid' : 'ghost'}
                                        intent='canvas'
                                        shape='rounded'
                                        size='sm'
                                        className='font-size-05 canvas-btn-compact'
                                        onClick={() => setSelectedAttr(attr.name)}
                                    >
                                        {attr.name}
                                    </Button>
                                ))}
                            </Row>

                            {tsLoading && (
                                <Text size='xs' tone='muted'>Loading time series...</Text>
                            )}

                            {!tsLoading && chartData.length > 0 && (
                                <Box>
                                    <Text size='xs' tone='muted' style={{ marginBottom: 4, display: 'block' }}>
                                        {activeAttr}{timeSeries?.unit ? ` (${timeSeries.unit})` : ''} — drag to select
                                    </Text>
                                    <ResponsiveContainer width='100%' height={110}>
                                        <LineChart
                                            data={chartData}
                                            onMouseDown={(e) => {
                                                if (!e?.activeLabel) return;
                                                setBrushStart(Number(e.activeLabel));
                                                setSelecting(true);
                                            }}
                                            onMouseMove={(e) => {
                                                if (!selecting || !e?.activeLabel) return;
                                                setBrushEnd(Number(e.activeLabel));
                                            }}
                                            onMouseUp={handleBrushComplete}
                                        >
                                            <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                                            <XAxis dataKey='frame' tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                                            <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} width={36} />
                                            <Tooltip
                                                contentStyle={{
                                                    fontSize: 10,
                                                    background: 'var(--color-surface-2)',
                                                    border: '1px solid var(--color-border-soft)'
                                                }}
                                            />
                                            <Line
                                                type='monotone'
                                                dataKey='value'
                                                stroke={CHART_COLOR}
                                                dot={false}
                                                strokeWidth={1.5}
                                            />
                                            {brushStart !== null && brushEnd !== null && (
                                                <ReferenceArea
                                                    x1={Math.min(brushStart, brushEnd)}
                                                    x2={Math.max(brushStart, brushEnd)}
                                                    fill={CHART_COLOR}
                                                    fillOpacity={0.2}
                                                />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Box>
                            )}

                            {!tsLoading && chartData.length === 0 && activeAttr && (
                                <Text size='xs' tone='muted'>No time series data for {activeAttr}.</Text>
                            )}
                        </Stack>
                    )}
                </Box>
            )}
        </Surface>
    );
});

GlobalAttributesPanel.displayName = 'GlobalAttributesPanel';

export default GlobalAttributesPanel;
