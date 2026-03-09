import { usePluginListingSubListingQueries } from '@/modules/plugin/hooks/listing/queries';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import { sceneArtifactsQuery } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { useEffect, useMemo } from 'react';
import usePluginCatalog from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { notifyApiError, isAccessDeniedError } from '@/shared/errors/notify-api-error';

import type { IExposureComputed } from '@/modules/plugin/api/entities/plugin/exposure';
import type { RenderableExposurePayload } from '@/modules/trajectory/api/dtos/scene-artifacts';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

export interface SubListingEntry {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    label: string;
};

interface UseCanvasTimelineTabsParams {
    trajectory: Trajectory | null | undefined;
    analysisId?: string;
};

const useCanvasTimelineTabs = ({ trajectory, analysisId }: UseCanvasTimelineTabsParams) => {
    const { ensurePluginById } = usePluginCatalog();
    const { pluginsById } = usePluginSelectors();

    const trajectoryId = trajectory?._id;

    const selectedAnalysis = useMemo(() => {
        if (!analysisId || !trajectory?.analysis?.length) return undefined;
        return trajectory.analysis.find((analysis) => analysis._id === analysisId);
    }, [trajectory?.analysis, analysisId]);

    const sceneArtifactsQueryResult = sceneArtifactsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId: analysisId ?? '',
            sourceType: 'plugin-exposure',
            projection: 'renderable-exposures',
            page: 1,
            limit: 1000
        },
        { enabled: !!trajectoryId && !!analysisId }
    );

    useEffect(() => {
        if (!sceneArtifactsQueryResult.error) return;
        if (isAccessDeniedError(sceneArtifactsQueryResult.error)) {
            notifyApiError(sceneArtifactsQueryResult.error, { fallbackTitle: 'You do not have permission to perform this action.' });
        }
    }, [sceneArtifactsQueryResult.error]);

    const sceneExposureFallback = useMemo(() => {
        return (sceneArtifactsQueryResult.data?.data ?? []) as RenderableExposurePayload[];
    }, [sceneArtifactsQueryResult.data?.data]);

    useEnsurePluginCatalogLoaded(Boolean(sceneExposureFallback.length));

    const pluginId = selectedAnalysis?.plugin;
    const plugin = pluginId ? pluginsById[pluginId] : undefined;
    const hasRenderablePluginData = sceneExposureFallback.length > 0;

    useEffect(() => {
        if (!pluginId || plugin || !hasRenderablePluginData) return;
        ensurePluginById(pluginId).catch((error: unknown) => {
            if (isAccessDeniedError(error)) {
                notifyApiError(error, { fallbackTitle: 'You do not have permission to perform this action.' });
            }
        });
    }, [pluginId, plugin, ensurePluginById, hasRenderablePluginData]);

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

    const hasAtomProperties = useMemo(() => {
        if (!plugin?.exposures?.length) return false;
        return plugin.exposures.some((item) => {
            const perAtomProperties = (item as IExposureComputed & { perAtomProperties?: unknown[] }).perAtomProperties;
            return Boolean(perAtomProperties?.length);
        });
    }, [plugin?.exposures]);

    const subListingQueries = usePluginListingSubListingQueries(
        listingExposures.map((exposure) => ({
            pluginId: resolvedPluginId!,
            exposureId: exposure.exposureId,
            exposureName: exposure.name,
            trajectoryId,
            limit: 1,
            page: 1
        }))
    );

    useEffect(() => {
        for (const result of subListingQueries) {
            if (!result.error) continue;
            if (isAccessDeniedError(result.error)) {
                notifyApiError(result.error, { fallbackTitle: 'You do not have permission to perform this action.' });
            }
        }
    }, [subListingQueries]);

    const subListingMap = useMemo(() => {
        const map = new Map<string, string[]>();
        for (let i = 0; i < listingExposures.length; i++) {
            const result = subListingQueries[i];
            if (!result?.data) continue;
            const subListingNames = result.data._meta?.subListingNames;
            if (subListingNames && subListingNames.length > 0) {
                map.set(listingExposures[i].exposureId, subListingNames);
            }
        }
        return map;
    }, [listingExposures, subListingQueries]);

    const subListingEntries = useMemo<SubListingEntry[]>(() => {
        const entries: SubListingEntry[] = [];
        for (const exposure of listingExposures) {
            const names = subListingMap.get(exposure.exposureId);
            if (!names) continue;
            for (const subListingName of names) {
                entries.push({
                    exposureId: exposure.exposureId,
                    exposureName: exposure.name,
                    subListingName,
                    label: formatSnakeCaseToTitle(subListingName)
                });
            }
        }
        return entries;
    }, [listingExposures, subListingMap]);

    return {
        pluginId: resolvedPluginId,
        isPluginReady: Boolean(plugin),
        listingExposures,
        hasAtomProperties,
        subListingEntries
    };
};

export default useCanvasTimelineTabs;
