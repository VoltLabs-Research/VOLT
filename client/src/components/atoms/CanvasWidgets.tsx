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

import React, { useMemo } from 'react';
import type { EditorWidgetsProps } from '@/types/canvas';
import useUIStore from '@/stores/ui';
import EditorSidebar from '@/components/organisms/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/components/atoms/scene/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/components/atoms/scene/SceneTopCenteredOptions';
import AnalysisConfiguration from '@/components/organisms/AnalysisConfiguration';
import SlicePlane from '@/components/organisms/SlicePlane';
import TimestepControls from '@/components/organisms/TimestepControls';
import DislocationResults from '@/components/atoms/DislocationResults';
import AnalysisConfigSelection from '../molecules/AnalysisConfigSelection';
import RenderOptions from '../molecules/RenderOptions';
import EditorWidget from '@/components/organisms/EditorWidget'
import { axisClasses } from '@mui/x-charts/ChartsAxis'
import { ScatterChart } from '@mui/x-charts'
import useTrajectoryStore from '@/stores/trajectories';

const CHART_COLORS = [
    '#3B82F6',
    '#10B981', 
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#F97316', 
    '#EC4899',
];

const CHART_THEME = {
    background: 'rgba(15, 23, 42, 0.8)', 
    border: 'rgba(148, 163, 184, 0.2)',
    text: {
        primary: '#F1F5F9',
        secondary: '#94A3B8',
        muted: '#64748B'
    },
    grid: 'rgba(148, 163, 184, 0.1)',
    axis: '#475569'
};

function niceNum(range: number, round: boolean): number {
    const exponent = Math.floor(Math.log10(range))
    const fraction = range / Math.pow(10, exponent)
    let niceFraction
    if (round) {
        if (fraction < 1.5) niceFraction = 1
        else if (fraction < 3) niceFraction = 2
        else if (fraction < 7) niceFraction = 5
        else niceFraction = 10
    } else {
        if (fraction <= 1) niceFraction = 1
        else if (fraction <= 2) niceFraction = 2
        else if (fraction <= 5) niceFraction = 5
        else niceFraction = 10
    }
    return niceFraction * Math.pow(10, exponent)
}

function generateNiceTicks(min: number, max: number, maxTicks = 8): number[] {
    const range = niceNum(max - min, false)
    const step = niceNum(range / (maxTicks - 1), true)
    const niceMin = Math.floor(min / step) * step
    const niceMax = Math.ceil(max / step) * step
    const ticks = []
    for (let val = niceMin; val <= niceMax; val += step) {
        ticks.push(Number(val.toFixed(6)))
    }
    return ticks
}

const CustomScatterPlot = ({
    title,
    xlabel,
    ylabel,
    series
}: {
    title: string
    xlabel: string
    ylabel: string
    series: { label: string; data: { x: number; y: number }[] }[]
}) => {
    if (!series.length) return null
    
    const allPoints = series.flatMap((s) => s.data)
    const xMin = Math.min(...allPoints.map((p) => p.x))
    const xMax = Math.max(...allPoints.map((p) => p.x))
    const yMin = Math.min(...allPoints.map((p) => p.y))
    const yMax = Math.max(...allPoints.map((p) => p.y))
    const xTicks = generateNiceTicks(xMin, xMax, 6) 
    const yTicks = generateNiceTicks(yMin, yMax, 6)

    // Asignar colores a las series
    const styledSeries = series.map((s, index) => ({
        ...s,
        color: CHART_COLORS[index % CHART_COLORS.length]
    }))

    return (
        <EditorWidget className='editor-chart-container'>
            <div className="chart-header">
                <h3 className='editor-chart-title' style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: CHART_THEME.text.primary,
                    margin: 0,
                    letterSpacing: '-0.025em'
                }}>
                    {title}
                </h3>
            </div>
            
            <div style={{ 
                borderRadius: '8px',
                margin: '0 12px'
            }}>
                <ScatterChart
                    height={350} 
                    series={styledSeries}
                    grid={{ 
                        horizontal: true, 
                        vertical: true 
                    }}
                    slotProps={{
                        legend: { 
                            sx: { 
                                fontSize: 13,
                                color: CHART_THEME.text.primary,
                                fontWeight: '500',
                                '& .MuiChartsLegend-series': {
                                    '& text': {
                                        fill: `${CHART_THEME.text.primary} !important`
                                    }
                                }
                            } 
                        }
                    }}
                    xAxis={[
                        {
                            min: xMin * 0.95, 
                            max: xMax * 1.05,
                            label: xlabel,
                            labelStyle: { 
                                fontSize: 14, 
                                fill: CHART_THEME.text.primary,
                                fontWeight: '500'
                            },
                            tickLabelStyle: {
                                fontSize: 12,
                                fill: CHART_THEME.text.secondary,
                                fontWeight: '400'
                            },
                            tickInterval: xTicks
                        }
                    ]}
                    yAxis={[
                        {
                            min: Math.max(0, yMin * 0.9),
                            max: yMax * 1.1,
                            label: ylabel,
                            labelStyle: { 
                                fontSize: 14, 
                                fill: CHART_THEME.text.primary,
                                fontWeight: '500'
                            },
                            tickLabelStyle: {
                                fontSize: 12,
                                fill: CHART_THEME.text.secondary,
                                fontWeight: '400'
                            },
                            tickInterval: yTicks
                        }
                    ]}
                    sx={{
                        [`& .${axisClasses.root}`]: {
                            line: { 
                                stroke: CHART_THEME.axis,
                                strokeWidth: 1.5
                            },
                            text: { fill: CHART_THEME.text.secondary }
                        },
                        [`& .${axisClasses.bottom}`]: { 
                            text: { fill: CHART_THEME.text.secondary },
                            line: { stroke: CHART_THEME.axis }
                        },
                        [`& .${axisClasses.left}`]: { 
                            text: { fill: CHART_THEME.text.secondary },
                            line: { stroke: CHART_THEME.axis }
                        },
                        '& .MuiChartsGrid-root': {
                            '& line': {
                                stroke: CHART_THEME.grid,
                                strokeWidth: 0.5,
                                strokeDasharray: '2,4'
                            }
                        },
                        '& .MuiScatterChart-root': {
                            '& circle': {
                                strokeWidth: 1.5,
                                stroke: 'rgba(255,255,255,0.3)',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
                            }
                        },
                        '& circle:hover': {
                            r: '6 !important',
                            strokeWidth: '2 !important',
                            stroke: 'rgba(255,255,255,0.8) !important',
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))'
                        },
                        '& .MuiChartsTooltip-root': {
                            border: `1px solid ${CHART_THEME.border}`,
                            borderRadius: '8px',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                        }
                    }}
                />
            </div>
        </EditorWidget>
    )
}

const AverageSegmentLengthPlot = () => {
    const avgSegmentSeries = useTrajectoryStore((state) => state.avgSegmentSeries);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    return avgSegmentSeries && (
        <CustomScatterPlot
            title={`Average Segment Length Analysis`}
            xlabel='RMSD (Å)'
            ylabel='Average Segment Length (Å)'
            series={avgSegmentSeries}
        />
    );
};

const StructureIdentificationRatePlot = () => {
    const idRateSeries = useTrajectoryStore((state) => state.idRateSeries);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    
    return idRateSeries && (
        <CustomScatterPlot
            title={`Structure Identification Rate Analysis`}
            xlabel='RMSD (Å)'
            ylabel='Identification Rate (%)'
            series={idRateSeries}
        />
    );
};

const TotalDislocationSegmentsPlot = () => {
    const dislocationsSeries = useTrajectoryStore((state) => state.dislocationSeries);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    return dislocationsSeries && (
        <CustomScatterPlot
            title={`Total Dislocation Segments Analysis`}
            xlabel='RMSD (Å)'
            ylabel='Total Segments Count'
            series={dislocationsSeries}
        />
    );
};

const CanvasWidgets = React.memo<EditorWidgetsProps>(({ 
    trajectory, 
    currentTimestep 
}) => {
    const showWidgets = useUIStore((state) => state.showEditorWidgets);
    const activeModifiers = useUIStore((state) => state.activeModifiers) ?? [];

    const modifiersMap = useMemo(() =>
        ({
            'slice-plane': SlicePlane,
            'dislocation-analysis-config': AnalysisConfiguration,
            'dislocation-results': DislocationResults,
            'render-options': RenderOptions,
            'average-segment-length': AverageSegmentLengthPlot,
            'structure-identification-rate': StructureIdentificationRatePlot,
            'total-dislocation-segments' : TotalDislocationSegmentsPlot
        }) as Record<string, React.ComponentType<any>>,
    []);

    const modifierComponents = useMemo(() => {
        const uniqueKeys = Array.from(new Set(activeModifiers));
        return uniqueKeys
        .map((key) => [key, modifiersMap[key] as React.ComponentType | undefined] as const)
        .filter(([, Comp]) => !!Comp);
    }, [activeModifiers, modifiersMap]);

    if (!showWidgets) return null;

    return (
        <>
            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions />
            <AnalysisConfigSelection />

            {(trajectory && currentTimestep !== undefined) && (
                <TimestepControls />
            )}

            {modifierComponents.map(([key, Comp]) => (
                <Comp key={`modifier-${key}`} />
            ))}
        </>
    );
});

CanvasWidgets.displayName = 'CanvasWidgets';

export default CanvasWidgets;