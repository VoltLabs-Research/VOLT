import React, { useMemo } from 'react';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
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
import { useShallow } from 'zustand/react/shallow';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';

const LEGACY_MODIFIERS_MAP = {
    'slice-plane': SlicePlane,
    'performance-monitor': PerformanceMonitor,
    'color-coding': ColorCoding,
    'particle-filter': ParticleFilter
} as const;

interface CanvasWidgetsProps {
    trajectory: Trajectory | null;
    currentTimestep: number | undefined;
    scene3DRef: React.RefObject<any>;
}

const CanvasWidgets = React.memo(({ trajectory, currentTimestep, scene3DRef }: CanvasWidgetsProps) => {
    const { searchParams } = useSearchParamsState();
    const { selectedIds: activeModifiers } = useSelectionParams({ paramName: 'modifiers' });
    const showWidgets = searchParams.get('widgets') !== 'false';
    const resultsParam = searchParams.get('results');
    const analysisConfigId = searchParams.get('analysis') || undefined;
    const plugins = usePluginStore(useShallow((s) => s.plugins));

    // Plugin modifier format in URL: plugin=pluginId:modifierSlug
    const pluginParam = searchParams.get('plugin');
    const activePluginModifier = useMemo(() => {
        if (!pluginParam) return null;
        const [pluginId, modifierSlug] = pluginParam.split(':');
        return pluginId && modifierSlug ? { pluginId, modifierSlug } : null;
    }, [pluginParam]);

    const legacyComponents = useMemo(() => {
        return activeModifiers
            .map((key) => [key, LEGACY_MODIFIERS_MAP[key as keyof typeof LEGACY_MODIFIERS_MAP]] as const)
            .filter(([, Comp]) => !!Comp);
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

            {resultsParam && (
                <PluginResultsViewer
                    pluginSlug={resultsParam}
                    analysisId={analysisConfigId || 'default'}
                />
            )}

            {activePluginModifier && activePlugin && trajectory && (
                <ModifierConfiguration
                    pluginId={activePluginModifier.pluginId}
                    modifierId={activePluginModifier.modifierSlug}
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
