import { useEffect, useMemo, useState } from 'react';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { usePluginCatalog } from '@/modules/plugin/presentation/hooks';
import { getListingRelevantExposures } from '@/modules/plugin/presentation/utils/listing-exposures';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import useSceneArtifactUseCases from '@/modules/trajectory/presentation/hooks/generated-scenes/use-scene-artifact-use-cases';
import type { RenderableExposurePayload } from '@/modules/trajectory/application/dtos/scene-artifacts';

interface UseCanvasTimelineTabsParams {
    trajectory: Trajectory | null | undefined;
    analysisId?: string;
}

const useCanvasTimelineTabs = ({ trajectory, analysisId }: UseCanvasTimelineTabsParams) => {
    const { listSceneArtifactsUseCase } = useSceneArtifactUseCases();
    const { ensurePluginById } = usePluginCatalog();
    const pluginsById = usePluginStore((state) => state.pluginsById);
    const [sceneExposureFallback, setSceneExposureFallback] = useState<RenderableExposurePayload[]>([]);

    const trajectoryId = trajectory?._id;

    const selectedAnalysis = useMemo(() => {
        if (!analysisId || !trajectory?.analysis?.length) return undefined;
        return trajectory.analysis.find((analysis) => analysis._id === analysisId);
    }, [trajectory?.analysis, analysisId]);

    const pluginId = selectedAnalysis?.plugin;
    const plugin = pluginId ? pluginsById[pluginId] : undefined;

    useEffect(() => {
        if (!pluginId || plugin) return;
        ensurePluginById(pluginId).catch(() => {});
    }, [pluginId, plugin, ensurePluginById]);

    useEffect(() => {
        let cancelled = false;

        const loadExposureFallback = async () => {
            if (!trajectoryId || !analysisId) {
                setSceneExposureFallback([]);
                return;
            }

            try {
                const response = await listSceneArtifactsUseCase.execute({
                    trajectoryId,
                    analysisId,
                    sourceType: 'plugin-exposure',
                    projection: 'renderable-exposures',
                    page: 1,
                    limit: 1000
                });

                if (cancelled) return;
                setSceneExposureFallback(response.data as RenderableExposurePayload[]);
            } catch {
                if (cancelled) return;
                setSceneExposureFallback([]);
            }
        };

        loadExposureFallback();
        return () => {
            cancelled = true;
        };
    }, [trajectoryId, analysisId, listSceneArtifactsUseCase]);

    const pluginListingExposures = useMemo(() => {
        return getListingRelevantExposures(plugin?.exposures);
    }, [plugin?.exposures]);

    const fallbackListingExposures = useMemo(() => {
        const uniqueById = new Map<string, { exposureId: string; name: string }>();

        for (const exposure of sceneExposureFallback) {
            if (!exposure?.exposureId || !exposure?.name) continue;
            if (!uniqueById.has(exposure.exposureId)) {
                uniqueById.set(exposure.exposureId, {
                    exposureId: exposure.exposureId,
                    name: exposure.name
                });
            }
        }

        return Array.from(uniqueById.values());
    }, [sceneExposureFallback]);

    const resolvedPluginId = useMemo(() => {
        if (pluginId && plugin) return pluginId;
        return sceneExposureFallback[0]?.pluginId;
    }, [pluginId, plugin, sceneExposureFallback]);

    const listingExposures = pluginListingExposures.length > 0
        ? pluginListingExposures
        : fallbackListingExposures;

    const atomExposureId = useMemo(() => {
        if (!plugin?.exposures?.length) return undefined;
        return plugin.exposures.find((item) => item.perAtomProperties?.length > 0)?._id;
    }, [plugin?.exposures]);

    return {
        pluginId: resolvedPluginId,
        isPluginReady: Boolean(plugin),
        listingExposures,
        atomExposureId
    };
};

export default useCanvasTimelineTabs;
