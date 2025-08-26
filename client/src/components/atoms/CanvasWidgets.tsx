/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { EditorWidgetsProps } from '@/types/canvas';
import useEditorUIStore from '@/stores/ui/editor';
import EditorSidebar from '@/components/organisms/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/components/atoms/scene/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/components/atoms/scene/SceneTopCenteredOptions';
import AnalysisConfiguration from '@/components/organisms/AnalysisConfiguration';
import SlicePlane from '@/components/organisms/SlicePlane';
import TimestepControls from '@/components/organisms/TimestepControls';
import DislocationResults from '@/components/atoms/DislocationResults';
import AnalysisConfigSelection from '../molecules/AnalysisConfigSelection';
import RenderOptions from '../molecules/RenderOptions';
import EditorWidget from '@/components/organisms/EditorWidget';
import { axisClasses } from '@mui/x-charts/ChartsAxis';
import { ScatterChart } from '@mui/x-charts';
import useTrajectoryStore from '@/stores/trajectories';
import { useRasterizedFrames } from '@/hooks/trajectory/use-rasterized-frames';

const CHART_COLORS = [
    '#7bc6ff',
    '#9bffd6',
    '#ffd37b',
    '#ff9bb0',
    '#c5a7ff',
    '#7be9ff',
    '#ffc07b',
    '#ffb6e3',
    '#88ffb2',
    '#b49bff',
    '#ff9e9e',
    '#7bffe9'
];

const THEME = {
    canvas: '#212121',
    panel: '#262626',
    border: '#333333',
    text: {
        primary: '#EDEDED',
        secondary: '#B6B6B6',
        muted: '#8A8A8A'
    },
    grid: '#2B2B2B',
    axis: '#3A3A3A',
    controlBg: '#2A2A2A',
    controlHover: '#2F2F2F',
    focus: '#5B9DFF'
};

function niceNum(range: number, round: boolean): number {
    const exponent = Math.floor(Math.log10(range || 1));
    const fraction = (range || 1) / Math.pow(10, exponent);
    let niceFraction;
    if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
    } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
}

function generateNiceTicks(min: number, max: number, maxTicks = 6): number[] {
    const span = Math.max(1e-9, max - min);
    const niceRange = niceNum(span, false);
    const step = niceNum(niceRange / Math.max(2, maxTicks - 1), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = niceMin; v <= niceMax + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
    return ticks;
}

const ControlBar = ({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) => {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: `1px solid ${THEME.border}`
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{left}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
        </div>
    );
};

const Dropdown = ({
    label,
    children,
    width = 320
}: {
    label: React.ReactNode;
    children: React.ReactNode;
    width?: number;
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: THEME.controlBg,
                    border: `1px solid ${THEME.border}`,
                    color: THEME.text.primary,
                    cursor: 'pointer'
                }}
            >
                {label}
                <span style={{ opacity: 0.7, fontSize: 12 }}>▾</span>
            </button>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width,
                        borderRadius: 12,
                        border: `1px solid ${THEME.border}`,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                        overflow: 'hidden',
                        zIndex: 30
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

const TimestepSelector = ({
    allItems,
    selected,
    colorMap,
    onChange
}: {
    allItems: string[];
    selected: Set<string>;
    colorMap: Record<string, string>;
    onChange: (next: Set<string>) => void;
}) => {
    const [query, setQuery] = useState('');
    const filtered = useMemo(
        () => allItems.filter(i => i.toLowerCase().includes(query.trim().toLowerCase())),
        [allItems, query]
    );
    const toggle = (k: string) => {
        const next = new Set(selected);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        onChange(next);
    };
    return (
        <Dropdown
            label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ opacity: 0.8, fontSize: 12 }}>Timesteps</span>
                    <span
                        style={{
                            fontSize: 12,
                            color: THEME.text.secondary,
                            background: '#1f1f1f',
                            border: `1px solid ${THEME.border}`,
                            padding: '2px 8px',
                            borderRadius: 999
                        }}
                    >
                        {selected.size}/{allItems.length}
                    </span>
                </span>
            }
            width={360}
        >
            <div style={{ padding: 10, borderBottom: `1px solid ${THEME.border}` }}>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search timestep"
                    style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: THEME.controlBg,
                        border: `1px solid ${THEME.border}`,
                        color: THEME.text.primary,
                        outline: 'none'
                    }}
                />
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {filtered.map((label) => {
                    const active = selected.has(label);
                    return (
                        <button
                            key={label}
                            onClick={() => toggle(label)}
                            title={label}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: `1px solid ${THEME.border}`,
                                color: THEME.text.primary,
                                cursor: 'pointer'
                            }}
                        >
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 999,
                                    background: colorMap[label] || '#888'
                                }}
                            />
                            <span style={{ fontSize: 13, flex: 1, opacity: active ? 1 : 0.75 }}>{label}</span>
                            <span
                                aria-hidden
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 4,
                                    border: `1px solid ${THEME.border}`,
                                    background: active ? THEME.focus : THEME.controlBg
                                }}
                            />
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div style={{ padding: 14, color: THEME.text.secondary, fontSize: 12 }}>No matches</div>
                )}
            </div>
            <div
                style={{
                    padding: 10,
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'space-between',
                    borderTop: `1px solid ${THEME.border}`,
                    background: '#242424'
                }}
            >
                <button
                    onClick={() => onChange(new Set(allItems))}
                    style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: THEME.controlBg,
                        border: `1px solid ${THEME.border}`,
                        color: THEME.text.primary,
                        cursor: 'pointer'
                    }}
                >
                    Show all
                </button>
                <button
                    onClick={() => onChange(new Set())}
                    style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: THEME.controlBg,
                        border: `1px solid ${THEME.border}`,
                        color: THEME.text.primary,
                        cursor: 'pointer'
                    }}
                >
                    Hide all
                </button>
            </div>
        </Dropdown>
    );
};

const ChartCard = ({
    title,
    xlabel,
    ylabel,
    series
}: {
    title: string;
    xlabel: string;
    ylabel: string;
    series: { label: string; data: { x: number; y: number }[] }[];
}) => {
    const [visible, setVisible] = useState<Set<string>>(() => new Set(series.map(s => s.label)));
    useEffect(() => {
        setVisible(new Set(series.map(s => s.label)));
    }, [series]);
    const colorMap = useMemo(() => {
        const map: Record<string, string> = {};
        series.forEach((s, i) => (map[s.label] = CHART_COLORS[i % CHART_COLORS.length]));
        return map;
    }, [series]);
    const styledSeries = useMemo(
        () => series.filter(s => visible.has(s.label)).map(s => ({ ...s, color: colorMap[s.label] })),
        [series, visible, colorMap]
    );

    const allPoints = styledSeries.flatMap(s => s.data);
    const xMin = allPoints.length ? Math.min(...allPoints.map(p => p.x)) : 0;
    const xMax = allPoints.length ? Math.max(...allPoints.map(p => p.x)) : 1;
    const yMin = allPoints.length ? Math.min(...allPoints.map(p => p.y)) : 0;
    const yMax = allPoints.length ? Math.max(...allPoints.map(p => p.y)) : 1;
    const xTicks = generateNiceTicks(xMin, xMax, 6);
    const yTicks = generateNiceTicks(yMin, yMax, 6);

    return (
        <EditorWidget className="editor-chart-container">
            <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${THEME.border}`  }}>
                <ControlBar
                    left={
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ color: THEME.text.primary, fontSize: 15, fontWeight: 600 }}>{title}</span>
                            <span style={{ color: THEME.text.secondary, fontSize: 12 }}>{visible.size}/{series.length} visible</span>
                        </div>
                    }
                    right={
                        <TimestepSelector
                            allItems={series.map(s => s.label)}
                            selected={visible}
                            colorMap={colorMap}
                            onChange={setVisible}
                        />
                    }
                />
                <div style={{ padding: '6px 10px 12px 10px' }}>
                    <ScatterChart
                        height={360}
                        series={styledSeries}
                        grid={{ horizontal: true, vertical: true }}
                        xAxis={[
                            {
                                min: xMin === xMax ? xMin - 1 : xMin * 0.95,
                                max: xMin === xMax ? xMax + 1 : xMax * 1.05,
                                label: xlabel,
                                labelStyle: { fontSize: 13, fill: THEME.text.primary },
                                tickLabelStyle: { fontSize: 11.5, fill: THEME.text.secondary },
                                tickInterval: xTicks
                            }
                        ]}
                        yAxis={[
                            {
                                min: yMin === yMax ? Math.max(0, yMin - 1) : Math.max(0, yMin * 0.9),
                                max: yMin === yMax ? yMax + 1 : yMax * 1.1,
                                label: ylabel,
                                labelStyle: { fontSize: 13, fill: THEME.text.primary },
                                tickLabelStyle: { fontSize: 11.5, fill: THEME.text.secondary },
                                tickInterval: yTicks
                            }
                        ]}
                        sx={{
                            background: THEME.canvas,
                            borderRadius: 5,
                            [`& .${axisClasses.root}`]: {
                                line: { stroke: THEME.axis, strokeWidth: 1.1 },
                                text: { fill: THEME.text.secondary }
                            },
                            [`& .${axisClasses.bottom}`]: {
                                text: { fill: THEME.text.secondary },
                                line: { stroke: THEME.axis }
                            },
                            [`& .${axisClasses.left}`]: {
                                text: { fill: THEME.text.secondary },
                                line: { stroke: THEME.axis }
                            },
                            '& .MuiChartsGrid-root line': {
                                stroke: THEME.grid,
                                strokeWidth: 0.6
                            },
                            '& .MuiScatterChart-root circle': {
                                strokeWidth: 1.25,
                                stroke: 'rgba(255,255,255,0.28)'
                            },
                            '& .MuiChartsLegend-root': { display: 'none' }
                        }}
                    />
                    {styledSeries.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 12, color: THEME.text.muted, fontSize: 12 }}>No visible series</div>
                    )}
                </div>
            </div>
        </EditorWidget>
    );
};

const AverageSegmentLengthPlot = () => {
    const avgSegmentSeries = useTrajectoryStore((s) => s.avgSegmentSeries);
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    return avgSegmentSeries && (
        <ChartCard
            title="Average Segment Length"
            xlabel="RMSD (Å)"
            ylabel="Average Segment Length (Å)"
            series={avgSegmentSeries}
        />
    );
};

const StructureIdentificationRatePlot = () => {
    const idRateSeries = useTrajectoryStore((s) => s.idRateSeries);
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    return idRateSeries && (
        <ChartCard
            title="Structure Identification Rate"
            xlabel="RMSD (Å)"
            ylabel="Identification Rate (%)"
            series={idRateSeries}
        />
    );
};

const TotalDislocationSegmentsPlot = () => {
    const dislocationsSeries = useTrajectoryStore((s) => s.dislocationSeries);

    return dislocationsSeries && (
        <ChartCard
            title="Total Dislocation Segments"
            xlabel="RMSD (Å)"
            ylabel="Total Segments"
            series={dislocationsSeries}
        />
    );
};

const CanvasWidgets = React.memo<EditorWidgetsProps>(({ trajectory, currentTimestep }) => {
    const showWidgets = useEditorUIStore((store) => store.showEditorWidgets);
    const activeModifiers = useEditorUIStore((store) => store.activeModifiers);
    const { items } = useRasterizedFrames(trajectory?._id);

    const modifiersMap = useMemo(() => ({
        'slice-plane': SlicePlane,
        'dislocation-analysis-config': AnalysisConfiguration,
        'dislocation-results': DislocationResults,
        'render-options': RenderOptions,
        'average-segment-length': AverageSegmentLengthPlot,
        'structure-identification-rate': StructureIdentificationRatePlot,
        'total-dislocation-segments': TotalDislocationSegmentsPlot
    }) as Record<string, React.ComponentType<any>>, []);

    const modifierComponents = useMemo(() => {
        const unique = Array.from(new Set(activeModifiers));
        return unique.map((k) => [k, modifiersMap[k] as React.ComponentType | undefined] as const).filter(([, C]) => !!C);
    }, [activeModifiers, modifiersMap]);
    
    if(!showWidgets) return null;
    
    return (
        <>
        {/*
            <EditorWidget className='raster-frames-container'>
                {items.map((it) => {
                    const src = it.src; 
                    const title = it.frame !== null ? `${it.frame}` : it.filename;
                    if (!src) return null;
                    return (
                        <figure key={it.filename} className='raster-frame-container'>
                            <figcaption className='raster-frame-caption-container'>Timestep {title}</figcaption>
                            <img src={src} alt={title} className='raster-frame' />
                        </figure>
                    );
                })}
            </EditorWidget>*/}

            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions />
            <AnalysisConfigSelection />
            {(trajectory && currentTimestep !== undefined) && <TimestepControls />}
            {modifierComponents.map(([key, Comp]) => (
                <Comp key={`modifier-${key}`} />
            ))}
        </>
    );
});

CanvasWidgets.displayName = 'CanvasWidgets';

export default CanvasWidgets;
