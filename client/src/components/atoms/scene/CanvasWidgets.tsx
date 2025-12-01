/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { EditorWidgetsProps } from '@/types/canvas';
import useEditorUIStore from '@/stores/ui/editor';
import EditorSidebar from '@/components/organisms/scene/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/components/atoms/scene/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/components/atoms/scene/SceneTopCenteredOptions';
import SlicePlane from '@/components/organisms/scene/SlicePlane';
import TimestepControls from '@/components/organisms/scene/TimestepControls';
import AnalysisConfigSelection from '@/components/molecules/common/AnalysisConfigSelection';
import ModifierConfiguration from '@/components/organisms/form/ModifierConfiguration';
import ChartViewer from '@/components/organisms/common/ChartViewer';
import Draggable from '@/components/atoms/common/Draggable';
import useModelStore from '@/stores/editor/model';
import usePluginStore from '@/stores/plugins';

const CanvasWidgets = React.memo<EditorWidgetsProps>(({ trajectory, currentTimestep, scene3DRef }) => {
    const showWidgets = useEditorUIStore((store) => store.showEditorWidgets);
    const activeModifiers = useEditorUIStore((store) => store.activeModifiers);
    const activeScene = useModelStore((state) => state.activeScene);
    const manifests = usePluginStore((state) => state.manifests);

    const activeExposure = useMemo(() => {
        if (activeScene.source !== 'plugin') return null;
        for (const manifest of Object.values(manifests)) {
            const modifiers = manifest.modifiers ?? {};
            for (const modifier of Object.values(modifiers)) {
                const exposure = modifier.exposure?.[activeScene.exposureId];
                if (exposure) return exposure;
            }
        }
        return null;
    }, [activeScene, manifests]);

    const isChart = activeExposure?.export?.name === 'ChartExporter';
    const [showChart, setShowChart] = useState(false);

    useEffect(() => {
        if (isChart) {
            setShowChart(true);
        }
    }, [isChart]);

    const legacyModifiersMap = useMemo(() => ({
        'slice-plane': SlicePlane
    }) as Record<string, React.ComponentType<any>>, []);

    const { legacyModifiers, pluginModifiers } = useMemo(() => {
        const legacy = activeModifiers.filter(m => m.type === 'legacy');
        const plugin = activeModifiers.filter(m => m.type === 'plugin');
        return { legacyModifiers: legacy, pluginModifiers: plugin };
    }, [activeModifiers]);

    const legacyComponents = useMemo(() => {
        return legacyModifiers
            .map((m) => [m.key, legacyModifiersMap[m.key]] as const)
            .filter(([, C]) => !!C);
    }, [legacyModifiers, legacyModifiersMap]);


    if (!showWidgets) return null;

    return (
        <>
            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions scene3DRef={scene3DRef} />
            <AnalysisConfigSelection />
            {(trajectory && currentTimestep !== undefined) && <TimestepControls />}

            {isChart && showChart && (
                <Draggable
                    enabled={true}
                    bounds='viewport'
                    axis='both'
                    doubleClickToDrag={false}
                    handle='.chart-viewer-drag-area'
                    scaleWhileDragging={0.98}
                    minWidth={400}
                    className='chart-viewer-drag-container'
                    minHeight={300}
                >
                    <div className='chart-viewer-container primary-surface'>
                        <ChartViewer
                            trajectoryId={trajectory?._id || ''}
                            analysisId={(activeScene as any).analysisId}
                            exposureId={(activeScene as any).exposureId}
                            timestep={currentTimestep || 0}
                            options={activeExposure?.export?.options}
                            filename={activeExposure?.results}
                            onClose={() => setShowChart(false)}
                        />
                    </div>
                </Draggable>
            )}

            {legacyComponents.map(([key, Comp]) => (
                <Comp key={`modifier-${key}`} />
            ))}

            {pluginModifiers.map((modifier) => {
                if (!modifier.pluginId || !modifier.modifierId || !trajectory?._id) return null;

                return (
                    <ModifierConfiguration
                        key={modifier.key}
                        pluginId={modifier.pluginId}
                        modifierId={modifier.modifierId}
                        trajectoryId={trajectory._id}
                        currentTimestep={currentTimestep}
                        className={`plugin-modifier-config-${modifier.modifierId}`}
                        onAnalysisSuccess={(analysisId) => {
                            console.log('Analysis started:', analysisId);
                            // toggleModifier(modifier.key);
                        }}
                        onAnalysisError={(error) => {
                            console.error('Analysis failed:', error);
                        }}
                    />
                );
            })}
        </>
    );
});

CanvasWidgets.displayName = 'CanvasWidgets';

export default CanvasWidgets;
