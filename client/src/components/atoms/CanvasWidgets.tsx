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
    const xTicks = generateNiceTicks(xMin, xMax, 8)
    const yTicks = generateNiceTicks(yMin, yMax, 8)

    return (
        <EditorWidget className='editor-chart-container'>
            <h3 className='editor-chart-title'>{title}</h3>
            <ScatterChart
                height={300}
                series={series}
                grid={{ horizontal: false, vertical: false }}
                slotProps={{
                    legend: { sx: { fontSize: 14, color: '#dadada' } }
                }}
                xAxis={[
                    {
                        min: xMin,
                        max: xMax,
                        label: xlabel,
                        labelStyle: { fontSize: 16, fill: '#dadada' },
                        tickInterval: xTicks
                    }
                ]}
                yAxis={[
                    {
                        min: 0,
                        max: yMax * 1.15,
                        label: ylabel,
                        labelStyle: { fontSize: 16, fill: '#dadada' },
                        tickInterval: yTicks
                    }
                ]}
                sx={{
                    [`& .${axisClasses.root}`]: {
                        line: { stroke: '#dadada' },
                        text: { fill: '#dadada' }
                    },
                    [`& .${axisClasses.bottom}`]: { text: { fill: '#dadada' } }
                }}
            />
        </EditorWidget>
    )
}

const AverageSegmentLengthPlot = () => {
    const avgSegmentSeries = useTrajectoryStore((state) => state.avgSegmentSeries);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    return avgSegmentSeries && (
        <CustomScatterPlot
            title={`${trajectory?.name ?? ''} - Average Segment Length`}
            xlabel='RMSD'
            ylabel='Average Segment Length'
            series={avgSegmentSeries}
        />
    );
};

const StructureIdentificationRatePlot = () => {
    const idRateSeries = useTrajectoryStore((state) => state.idRateSeries);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    
    return idRateSeries && (
        <CustomScatterPlot
            title={`${trajectory?.name ?? ''} - Identification Rate`}
            xlabel='RMSD'
            ylabel='Structure Identification Rate %'
            series={idRateSeries}
        />
    );
};

const TotalDislocationSegmentsPlot = () => {
    const dislocationsSeries = useTrajectoryStore((state) => state.dislocationSeries);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    return dislocationsSeries && (
        <CustomScatterPlot
            title={`${trajectory?.name ?? ''} - Total Dislocation Segments`}
            xlabel='RMSD'
            ylabel='Total Dislocation Segments'
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