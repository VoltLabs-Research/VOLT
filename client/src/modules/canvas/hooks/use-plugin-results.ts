import useCanvasUrlState from './use-canvas-url-state';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';

import { useExportAnalysisResultsMutation } from '@/modules/plugin/hooks/plugin/queries';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';

interface UsePluginResultsOptions {
    pluginId: string;
    analysisId: string;
};

const usePluginResults = ({ pluginId, analysisId }: UsePluginResultsOptions) => {
    const { setResultsPluginId } = useCanvasUrlState();
    useEnsurePluginCatalogLoaded(Boolean(pluginId));
    const { pluginsById } = usePluginSelectors();
    const plugin = pluginsById[pluginId];
    const { trajectoryId: routeTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const trajectoryId = routeTrajectoryId;
    const teamId = useSelectedTeamId();
    const exportResultsMutation = useExportAnalysisResultsMutation();

    const isDownloading = exportResultsMutation.isPending;
    const [activeTab, setActiveTab] = useState(0);

    const exposures = plugin?.exposures ?? [];

    const listingExposures = useMemo(() => getListingRelevantExposures(exposures), [exposures]);

    const hasAtomProperties = useMemo(
        () => exposures.some((e: any) => e.perAtomProperties?.length > 0),
        [exposures]
    );

    const tabs = useMemo(() => {
        const result = listingExposures.map((e: any) => e.name as string);
        if (hasAtomProperties) result.push('Atoms');
        return result;
    }, [listingExposures, hasAtomProperties]);

    const isAtomsTab = hasAtomProperties && activeTab === listingExposures.length;

    const activeExposureName = !isAtomsTab && activeTab < listingExposures.length
        ? listingExposures[activeTab].name
        : null;

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
        } catch(error: unknown) {
            if(isAccessDeniedError(error)) return;
        }
    }, [pluginId, analysisId, exportResultsMutation]);

    return {
        title: plugin?.modifier?.name,
        tabs,
        activeTab,
        setActiveTab,
        activeExposureName,
        isAtomsTab,
        hasAtomProperties,
        trajectoryId,
        teamId,
        isDownloading,
        isEmpty: tabs.length === 0,
        close,
        download
    };
};

export default usePluginResults;
