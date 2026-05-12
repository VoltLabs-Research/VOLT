import useCanvasUrlState from './use-canvas-url-state';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useExportAnalysisResultsMutation } from '@/modules/plugin/hooks/plugin/queries';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { sceneArtifactsQuery } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import useAnalysisAtomPropertiesAvailability from '@/modules/trajectory/hooks/trajectory/use-analysis-atom-properties-availability';
import { isAccessDeniedError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';

interface UsePluginResultsOptions {
    pluginId: string;
    analysisId: string;
}

type PluginResultsTab =
    | { key: string; label: string; type: 'listing'; exposureId: string; exposureName: string }
    | { key: string; label: string; type: 'atoms' }
    | { key: string; label: string; type: 'chart'; artifact: SceneArtifact };

const resolveChartLabel = (artifact: SceneArtifact): string => {
    const metadataName = typeof artifact.metadata?.exposureName === 'string'
        ? artifact.metadata.exposureName.trim()
        : '';

    return artifact.displayName || metadataName || 'Chart';
};

const usePluginResults = ({ pluginId, analysisId }: UsePluginResultsOptions) => {
    const { setResultsPluginId } = useCanvasUrlState();
    useEnsurePluginCatalogLoaded(Boolean(pluginId));

    const { pluginsById } = usePluginSelectors();
    const plugin = pluginsById[pluginId];
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const { trajectoryId: routeTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const trajectoryId = routeTrajectoryId;
    const teamId = useSelectedTeamId();
    const exportResultsMutation = useExportAnalysisResultsMutation();

    const isDownloading = exportResultsMutation.isPending;
    const [activeTab, setActiveTab] = useState(0);

    const exposures = plugin?.exposures ?? [];
    const listingExposures = useMemo(() => getListingRelevantExposures(exposures), [exposures]);
    const { hasAtomProperties } = useAnalysisAtomPropertiesAvailability({
        trajectoryId,
        analysisId,
        timestep: currentTimestep
    });
    const chartArtifactsQuery = sceneArtifactsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId,
            timestep: currentTimestep,
            sourceType: 'plugin-exposure',
            page: 1,
            limit: 100
        },
        {
            enabled: Boolean(trajectoryId && analysisId && currentTimestep !== undefined)
        }
    );

    const chartArtifacts = useMemo(() => {
        return (chartArtifactsQuery.data?.data ?? [])
            .filter((artifact): artifact is SceneArtifact => {
                const candidate = artifact as SceneArtifact;
                const metadata = candidate.metadata ?? {};
                return candidate.sourceType === 'plugin-exposure'
                    && typeof candidate._id === 'string'
                    && typeof candidate.objectName === 'string'
                    && candidate.objectName.endsWith('.png')
                    && (
                        metadata.exporter === 'ChartExporter'
                        || metadata.exportType === 'chart-png'
                    );
            });
    }, [chartArtifactsQuery.data?.data]);

    const tabs = useMemo<PluginResultsTab[]>(() => {
        const result: PluginResultsTab[] = listingExposures.map((exposure) => ({
            key: `listing:${exposure.exposureId}`,
            label: exposure.name,
            type: 'listing',
            exposureId: exposure.exposureId,
            exposureName: exposure.name
        }));
        if (hasAtomProperties) {
            result.push({ key: 'atoms', label: 'Atoms', type: 'atoms' });
        }
        chartArtifacts.forEach((artifact) => {
            result.push({
                key: `chart:${artifact._id}`,
                label: resolveChartLabel(artifact),
                type: 'chart',
                artifact
            });
        });
        return result;
    }, [listingExposures, hasAtomProperties, chartArtifacts]);

    useEffect(() => {
        if (activeTab < tabs.length) return;
        setActiveTab(0);
    }, [activeTab, tabs.length]);

    const activeTabItem = tabs[activeTab];
    const activeExposureName = activeTabItem?.type === 'listing'
        ? activeTabItem.exposureName
        : null;

    const activeExposureId = activeTabItem?.type === 'listing'
        ? activeTabItem.exposureId
        : null;
    const isAtomsTab = activeTabItem?.type === 'atoms';
    const activeChartArtifact = activeTabItem?.type === 'chart' ? activeTabItem.artifact : null;

    const close = useCallback(
        () => setResultsPluginId(undefined, { replace: true }),
        [setResultsPluginId]
    );

    const download = useCallback(async () => {
        try {
            await showPromise(
                (async () => {
                    const blob = await exportResultsMutation.mutateAsync({ pluginId, analysisId });
                    triggerBrowserDownload(blob, `${pluginId}_analysis_${analysisId}.zip`);
                    return blob;
                })(),
                {
                    loading: { title: 'Downloading analysis results...' },
                    success: { title: 'Analysis results downloaded successfully' },
                    error: { title: 'Failed to download results' }
                }
            );
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
        }
    }, [pluginId, analysisId, exportResultsMutation]);

    return {
        title: plugin?.modifier?.name,
        tabs,
        activeTab,
        setActiveTab,
        activeExposureName,
        activeExposureId,
        isAtomsTab,
        activeChartArtifact,
        hasAtomProperties,
        trajectoryId,
        teamId,
        currentTimestep,
        isDownloading,
        isEmpty: tabs.length === 0,
        close,
        download
    };
};

export default usePluginResults;
