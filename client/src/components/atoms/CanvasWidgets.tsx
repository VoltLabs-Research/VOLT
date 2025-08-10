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

const CanvasWidgets = React.memo<EditorWidgetsProps>(({ 
  trajectory, 
  currentTimestep 
}) => {
    const showWidgets = useUIStore((state) => state.showEditorWidgets);
    const activeModifiers = useUIStore((state) => state.activeModifiers);

    const modifiersMap = useMemo(() => ({
        'slice-plane': SlicePlane,
        'dislocation-analysis-config': AnalysisConfiguration,
    } as Record<string, React.ComponentType<any>>), []);

    if(!showWidgets) return null;

    const modifierComponents = useMemo(() => {
        const uniqueKeys = Array.from(new Set(activeModifiers));
        return uniqueKeys
        .map((key) => [key, modifiersMap[key] as React.ComponentType | undefined] as const)
        .filter(([, Comp]) => !!Comp);
    }, [activeModifiers, modifiersMap]);

    return (
        <>
            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions />

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