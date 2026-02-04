import React, { useMemo } from 'react';
import EditorSidebar from '@/modules/canvas/presentation/components/organisms/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/modules/canvas/presentation/components/atoms/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/modules/canvas/presentation/components/atoms/SceneTopCenteredOptions';
import TimestepControls from '@/modules/canvas/presentation/components/organisms/TimestepControls';
import SlicePlane from '@/modules/canvas/presentation/components/organisms/SlicePlane';
import PerformanceMonitor from '@/modules/canvas/presentation/components/organisms/PerformanceMonitor';
import ColorCoding from '@/modules/canvas/presentation/components/organisms/ColorCoding';
import ParticleFilter from '@/modules/canvas/presentation/components/organisms/ParticleFilter';
import PluginResultsViewer from '@/modules/canvas/presentation/components/organisms/PluginResultsViewer';
import ModifierConfiguration from '@/modules/plugin/presentation/components/organisms/ModifierConfiguration';
import { usePluginStore } from '@/modules/plugin';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';

interface CanvasWidgetsProps {
    trajectory: Trajectory | null;
    currentTimestep: number | undefined;
    scene3DRef: React.RefObject<any>;
}

const CanvasWidgets = React.memo(({ trajectory, currentTimestep, scene3DRef }: CanvasWidgetsProps) => {
    const showWidgets = useCanvasUIStore((store) => store.showEditorWidgets);
    const activeModifiers = useCanvasUIStore((store) => store.activeModifiers);
    const resultsViewerData = useCanvasUIStore((store) => store.resultsViewerData);
    const plugins = usePluginStore((s) => s.plugins);

    const legacyModifiersMap = useMemo(() => ({
        'slice-plane': SlicePlane,
        'performance-monitor': PerformanceMonitor,
        'color-coding': ColorCoding,
        'particle-filter': ParticleFilter
    }) as Record<string, React.ComponentType<any>>, []);

    const legacyComponents = useMemo(() => {
        return activeModifiers
            .filter((modifier) => modifier.type === 'legacy')
            .map((modifier) => [modifier.key, legacyModifiersMap[modifier.key]] as const)
            .filter(([, Comp]) => !!Comp);
    }, [activeModifiers, legacyModifiersMap]);

    const activePluginModifier = useMemo(() => {
        return activeModifiers.find((modifier) => modifier.type === 'plugin');
    }, [activeModifiers]);

    const activePlugin = useMemo(() => {
        if (!activePluginModifier?.pluginId) return null;
        return plugins.find((plugin) => plugin._id === activePluginModifier.pluginId) ?? null;
    }, [activePluginModifier?.pluginId, plugins]);

    if (!showWidgets) return null;

    return (
        <>
            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions scene3DRef={scene3DRef} />
            {(trajectory && currentTimestep !== undefined) && <TimestepControls />}

            {resultsViewerData && (
                <PluginResultsViewer
                    pluginSlug={resultsViewerData.pluginSlug}
                    pluginName={resultsViewerData.pluginName}
                    analysisId={resultsViewerData.analysisId}
                    exposures={resultsViewerData.exposures}
                />
            )}

            {activePluginModifier && activePlugin && trajectory && (
                <ModifierConfiguration
                    pluginId={activePluginModifier.pluginId || ''}
                    modifierId={activePluginModifier.modifierId || activePlugin.slug}
                    trajectoryId={trajectory._id}
                    currentTimestep={currentTimestep}
                />
            )}

            {legacyComponents.map(([key, Comp]) => (
                <Comp key={`modifier-${key}`} />
            ))}
        </>
    );
});

CanvasWidgets.displayName = 'CanvasWidgets';

export default CanvasWidgets;
