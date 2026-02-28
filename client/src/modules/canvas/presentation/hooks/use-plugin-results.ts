import { useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useCanvasUrlState from './use-canvas-url-state';
import { usePluginStore } from '@/modules/plugin';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { getListingRelevantExposures } from '@/modules/plugin/presentation/utils/listing-exposures';

interface UsePluginResultsOptions {
    pluginId: string;
    analysisId: string;
}

const usePluginResults = ({ pluginId, analysisId }: UsePluginResultsOptions) => {
    const { setResultsPluginId } = useCanvasUrlState();
    const plugin = usePluginStore((state) => state.pluginsById[pluginId]);
    const trajectoryId = useTrajectoryStore((state) => state.trajectory?._id);
    const teamId = useTeamStore(useShallow((state) => state.selectedTeam?._id));
    const { pluginRepository } = usePluginUseCases();

    const [isDownloading, setIsDownloading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const exposures = plugin?.exposures ?? [];

    const listingExposures = useMemo(() => getListingRelevantExposures(exposures), [exposures]);

    const atomExposureId = useMemo(
        () => exposures.find((e: any) => e.perAtomProperties?.length)?._id,
        [exposures]
    );

    const tabs = useMemo(() => {
        const result = listingExposures.map((e: any) => e.name as string);
        if (atomExposureId) result.push('Atoms');
        return result;
    }, [listingExposures, atomExposureId]);

    const isAtomsTab = Boolean(atomExposureId) && activeTab === listingExposures.length;

    const activeExposureName = !isAtomsTab && activeTab < listingExposures.length
        ? listingExposures[activeTab].name
        : null;

    const close = useCallback(
        () => setResultsPluginId(undefined, { replace: true }),
        [setResultsPluginId]
    );

    const download = useCallback(async () => {
        try {
            setIsDownloading(true);
            await showPromise(
                (async () => {
                    const blob = await pluginRepository.exportAnalysisResults(pluginId, analysisId);
                    triggerBrowserDownload(blob, `${pluginId}_analysis_${analysisId}.zip`);
                    return blob;
                })(),
                {
                    loading: { title: 'Downloading analysis results...' },
                    success: { title: 'Analysis results downloaded successfully' },
                    error: { title: 'Failed to download results' }
                }
            );
        } finally {
            setIsDownloading(false);
        }
    }, [pluginId, analysisId, pluginRepository]);

    return {
        title: plugin?.modifier?.name,
        tabs,
        activeTab,
        setActiveTab,
        activeExposureName,
        isAtomsTab,
        atomExposureId,
        trajectoryId,
        teamId,
        isDownloading,
        isEmpty: tabs.length === 0,
        close,
        download
    };
};

export default usePluginResults;
