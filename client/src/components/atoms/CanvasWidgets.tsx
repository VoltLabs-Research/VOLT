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
import useEditorUIStore from '@/stores/ui/editor';
import EditorSidebar from '@/components/organisms/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/components/atoms/scene/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/components/atoms/scene/SceneTopCenteredOptions';
import SlicePlane from '@/components/organisms/SlicePlane';
import TimestepControls from '@/components/organisms/TimestepControls';
import DislocationResults from '@/components/atoms/DislocationResults';
import AnalysisConfigSelection from '@/components/molecules/AnalysisConfigSelection';
import ModifierConfiguration from '@/components/organisms/ModifierConfiguration';

const CanvasWidgets = React.memo<EditorWidgetsProps>(({ trajectory, currentTimestep, scene3DRef }) => {
    const showWidgets = useEditorUIStore((store) => store.showEditorWidgets);
    const activeModifiers = useEditorUIStore((store) => store.activeModifiers);

    const legacyModifiersMap = useMemo(() => ({
        'slice-plane': SlicePlane,
        'dislocation-results': DislocationResults
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

    
    if(!showWidgets) return null;
    
    return (
        <>
            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions scene3DRef={scene3DRef} />
            <AnalysisConfigSelection />
            {(trajectory && currentTimestep !== undefined) && <TimestepControls />}
            
            {legacyComponents.map(([key, Comp]) => (
                <Comp key={`modifier-${key}`} />
            ))}
            
            {pluginModifiers.map((modifier) => {
                if(!modifier.pluginId || !modifier.modifierId || !trajectory?._id) return null;
                
                return (
                    <ModifierConfiguration
                        key={modifier.key}
                        pluginId={modifier.pluginId}
                        modifierId={modifier.modifierId}
                        trajectoryId={trajectory._id}
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
