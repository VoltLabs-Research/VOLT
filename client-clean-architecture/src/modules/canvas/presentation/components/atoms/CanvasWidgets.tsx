import React, { useMemo } from 'react';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';
import EditorSidebar from '@/modules/canvas/presentation/components/organisms/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/modules/canvas/presentation/components/atoms/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/modules/canvas/presentation/components/atoms/SceneTopCenteredOptions';
import TimestepControls from '@/modules/canvas/presentation/components/organisms/TimestepControls';
import PluginResultsViewer from '@/modules/canvas/presentation/components/organisms/PluginResultsViewer';
import { usePluginStore } from '@/modules/plugin';
import { useShallow } from 'zustand/react/shallow';
import { buildModifierWidgetEntries } from '@/modules/canvas/presentation/modifiers/registry';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';

interface CanvasWidgetsProps {
    trajectory: Trajectory | null;
    currentTimestep: number | undefined;
    scene3DRef: React.RefObject<any>;
}

const CanvasWidgets = React.memo(({ trajectory, currentTimestep, scene3DRef }: CanvasWidgetsProps) => {
    const { activeModifiers, showWidgets, resultsSlug, analysisId, pluginSelection } = useCanvasUrlState();
    const plugins = usePluginStore(useShallow((s) => s.plugins));

    const activePlugin = useMemo(() => {
        if (!pluginSelection?.pluginId) return null;
        return plugins.find((plugin) => plugin._id === pluginSelection.pluginId) ?? null;
    }, [pluginSelection?.pluginId, plugins]);

    const modifierWidgets = useMemo(() => buildModifierWidgetEntries({
        activeModifierIds: activeModifiers,
        pluginSelection,
        activePlugin,
        trajectoryId: trajectory?._id,
        currentTimestep
    }), [activeModifiers, pluginSelection, activePlugin, trajectory?._id, currentTimestep]);

    const widgets = useMemo(() => {
        const entries: Array<{ key: string; element: React.ReactNode }> = [
            { key: 'sidebar', element: <EditorSidebar /> },
            { key: 'trajectory-status', element: <TrajectoryVisibilityStatusFloatIcon /> },
            { key: 'scene-options', element: <SceneTopCenteredOptions scene3DRef={scene3DRef} /> }
        ];

        if (trajectory && currentTimestep !== undefined) {
            entries.push({ key: 'timestep-controls', element: <TimestepControls /> });
        }

        if (resultsSlug) {
            entries.push({
                key: 'plugin-results',
                element: (
                    <PluginResultsViewer
                        pluginSlug={resultsSlug}
                        analysisId={analysisId || 'default'}
                    />
                )
            });
        }

        modifierWidgets.forEach(({ key, Component, props }) => {
            entries.push({ key, element: <Component {...(props ?? {})} /> });
        });

        return entries;
    }, [scene3DRef, trajectory, currentTimestep, resultsSlug, analysisId, modifierWidgets]);

    if (!showWidgets) return null;

    return (
        <>
            {widgets.map((widget) => (
                <React.Fragment key={widget.key}>{widget.element}</React.Fragment>
            ))}
        </>
    );
});

CanvasWidgets.displayName = 'CanvasWidgets';

export default CanvasWidgets;
