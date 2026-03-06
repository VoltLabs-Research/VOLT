import { useEffect, useMemo, useState } from 'react';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { usePluginCatalog } from '@/modules/plugin/presentation/hooks';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-services';
import { getListingRelevantExposures } from '@/modules/plugin/presentation/utilities/listing-exposures';
import formatSnakeCaseToTitle from '@/modules/plugin/presentation/utilities/format-snake-case';
import type { IExposureComputed } from '@/modules/plugin/domain/entities/Exposure';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import useSceneArtifactUseCases from '@/modules/trajectory/presentation/hooks/generated-scenes/use-scene-artifact-services';
import type { RenderableExposurePayload } from '@/modules/trajectory/application/dtos/scene-artifacts';
import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';

export interface SubListingEntry {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    label: string;
}

interface UseCanvasTimelineTabsParams {
    trajectory: Trajectory | null | undefined;
    analysisId?: string;
}

const useCanvasTimelineTabs = ({ trajectory, analysisId }: UseCanvasTimelineTabsParams) => {
    const { listSceneArtifactsUseCase } = useSceneArtifactUseCases();
    const { pluginListingRepository } = usePluginUseCases();
    const { ensurePluginById } = usePluginCatalog();
    const pluginsById = usePluginStore((state) => state.pluginsById);
    const [sceneExposureFallback, setSceneExposureFallback] = useState<RenderableExposurePayload[]>([]);
    const [subListingMap, setSubListingMap] = useState<Map<string, string[]>>(new Map());

    const trajectoryId = trajectory?._id;

    const selectedAnalysis = useMemo(() => {
        if (!analysisId || !trajectory?.analysis?.length) return undefined;
        return trajectory.analysis.find((analysis) => analysis._id === analysisId);
    }, [trajectory?.analysis, analysisId]);

    const pluginId = selectedAnalysis?.plugin;
    const plugin = pluginId ? pluginsById[pluginId] : undefined;

    useEffect(() => {
        if (!pluginId || plugin) return;
        ensurePluginById(pluginId).catch((error: unknown) => {
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                sileo.error({ title: msg });
            }
        });
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
            } catch(error: unknown) {
                if (cancelled) return;
                if(ApiError.isRBACError(error)){
                    const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                    sileo.error({ title: msg });
                }
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

    const hasAtomProperties = useMemo(() => {
        if (!plugin?.exposures?.length) return false;
        return plugin.exposures.some((item) => {
            const perAtomProperties = (item as IExposureComputed & { perAtomProperties?: unknown[] }).perAtomProperties;
            return Boolean(perAtomProperties?.length);
        });
    }, [plugin?.exposures]);

    useEffect(() => {
        setSubListingMap(new Map());
    }, [analysisId]);

    useEffect(() => {
        if (!resolvedPluginId || !trajectoryId || listingExposures.length === 0) {
            return;
        }

        let cancelled = false;

        const discoverSubListings = async () => {
            const discoveredMap = new Map<string, string[]>();

            for (const exposure of listingExposures) {
                if (cancelled) return;

                try {
                    const response = await pluginListingRepository.getListing({
                        pluginId: resolvedPluginId,
                        exposureId: exposure.exposureId,
                        exposureName: exposure.name,
                        trajectoryId,
                        limit: 1,
                        page: 1
                    });

                    const subListingNames = response._meta?.subListingNames;
                    if (subListingNames && subListingNames.length > 0) {
                        discoveredMap.set(exposure.exposureId, subListingNames);
                    }
                } catch (error: unknown) {
                    if (ApiError.isRBACError(error)) {
                        let message = 'You do not have permission to perform this action.';
                        if (error instanceof ApiError) {
                            message = error.getFriendlyMessage();
                        }
                        sileo.error({ title: message });
                    }
                }
            }

            if (!cancelled) {
                setSubListingMap(discoveredMap);
            }
        };

        discoverSubListings();

        return () => {
            cancelled = true;
        };
    }, [resolvedPluginId, trajectoryId, listingExposures, pluginListingRepository]);

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
