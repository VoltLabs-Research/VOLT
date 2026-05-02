import usePluginCatalog, { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import { sceneArtifactsQuery } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import useAnalysisAtomPropertiesAvailability from '@/modules/trajectory/hooks/trajectory/use-analysis-atom-properties-availability';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { useEffect, useMemo } from 'react';

import type { RenderableExposurePayload } from '@/modules/trajectory/api/dtos/scene-artifacts';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface FallbackListingExposure {
    exposureId: string;
    name: string;
}

interface UseCanvasTimelineTabsParams {
    trajectory: Trajectory | null | undefined;
    analysisId?: string;
}

const useCanvasTimelineTabs = ({ trajectory, analysisId }: UseCanvasTimelineTabsParams) => {
    const { ensurePluginById } = usePluginCatalog();
    const { pluginsById } = usePluginSelectors();
    const currentTimestep = useEditorStore((state) => state.currentTimestep);

    const trajectoryId = trajectory?._id;
    const fallbackTimestep = trajectory?.frames?.[0]?.timestep;
    const atomPropertiesTimestep = currentTimestep ?? fallbackTimestep;
    const analysesQuery = useAnalysesByTrajectoryQuery(
        { trajectoryId: trajectoryId ?? '', page: 1, limit: 100 },
        { enabled: !!trajectoryId && !!analysisId }
    );
    const analyses = analysesQuery.data?.data ?? trajectory?.analysis ?? [];

    const selectedAnalysis = useMemo(() => {
        if (!analysisId) {
            return undefined;
        }

        return analyses.find((analysis) => analysis._id === analysisId) ?? findCachedAnalysisById({
            analysisId,
            trajectoryId,
            fallbackAnalyses: analyses
        });
    }, [analyses, analysisId, trajectoryId]);
    const pluginId = selectedAnalysis?.plugin;
    const plugin = pluginId ? pluginsById[pluginId] : undefined;

    const pluginListingExposures = useMemo(() => {
        return getListingRelevantExposures(plugin?.exposures);
    }, [plugin?.exposures]);

    const shouldUseSceneExposureFallback = !pluginId || !plugin || pluginListingExposures.length === 0;

    const sceneArtifactsQueryResult = sceneArtifactsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId: analysisId ?? '',
            sourceType: 'plugin-exposure',
            projection: 'renderable-exposures',
            page: 1,
            limit: 1000
        },
        { enabled: !!trajectoryId && !!analysisId && shouldUseSceneExposureFallback }
    );

    useEffect(() => {
        if (!sceneArtifactsQueryResult.error) return;
        if (isAccessDeniedError(sceneArtifactsQueryResult.error)) {
            reportError(sceneArtifactsQueryResult.error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'You do not have permission to perform this action.'
            });
        }
    }, [sceneArtifactsQueryResult.error]);

    const sceneExposureFallback = useMemo(() => {
        return (sceneArtifactsQueryResult.data?.data ?? []) as RenderableExposurePayload[];
    }, [sceneArtifactsQueryResult.data?.data]);

    useEnsurePluginCatalogLoaded(Boolean(pluginId || sceneExposureFallback.length));

    useEffect(() => {
        if (!pluginId || plugin) return;
        ensurePluginById(pluginId).catch((error: unknown) => {
            if (isAccessDeniedError(error)) {
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to perform this action.'
                });
            }
        });
    }, [pluginId, plugin, ensurePluginById]);

    const fallbackListingExposures = useMemo(() => {
        const uniqueById = new Map<string, FallbackListingExposure>();

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
        if (pluginId) return pluginId;
        return sceneExposureFallback[0]?.pluginId;
    }, [pluginId, plugin, sceneExposureFallback]);

    const listingExposures = pluginListingExposures.length > 0
        ? pluginListingExposures
        : fallbackListingExposures;

    const atomPropertiesAvailability = useAnalysisAtomPropertiesAvailability({
        trajectoryId,
        analysisId,
        timestep: atomPropertiesTimestep
    });

    useEffect(() => {
        if (!atomPropertiesAvailability.error) return;
        if (isAccessDeniedError(atomPropertiesAvailability.error)) {
            reportError(atomPropertiesAvailability.error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'You do not have permission to perform this action.'
            });
        }
    }, [atomPropertiesAvailability.error]);

    const hasAtomProperties = atomPropertiesAvailability.hasAtomProperties;

    return {
        pluginId: resolvedPluginId,
        isPluginReady: Boolean(plugin ?? resolvedPluginId),
        listingExposures,
        hasAtomProperties
    };
};

export default useCanvasTimelineTabs;
