import { useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useToast from '@/shared/presentation/hooks/use-toast';
import useCanvasUrlState from './use-canvas-url-state';
import { usePluginStore } from '@/modules/plugin';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';

interface UsePluginResultsOptions {
    pluginSlug: string;
    analysisId: string;
}

const usePluginResults = ({ pluginSlug, analysisId }: UsePluginResultsOptions) => {
    const { setResultsSlug } = useCanvasUrlState();
    const plugin = usePluginStore((state) => state.pluginsBySlug[pluginSlug]);
    const trajectoryId = useTrajectoryStore((state) => state.trajectory?._id);
    const teamId = useTeamStore(useShallow((state) => state.selectedTeam?._id));
    const { pluginRepository } = usePluginUseCases();
    const { showSuccess } = useToast();

    const [isDownloading, setIsDownloading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const exposures = plugin?.exposures ?? [];

    const listingExposures = useMemo(
        () => exposures.filter((exp: any) => Boolean(exp.name)),
        [exposures]
    );

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

    const activeListingSlug = !isAtomsTab && activeTab < listingExposures.length
        ? listingExposures[activeTab].name
        : null;

    const close = useCallback(
        () => setResultsSlug(undefined, { replace: true }),
        [setResultsSlug]
    );

    const download = useCallback(async () => {
        try {
            setIsDownloading(true);
            const blob = await pluginRepository.exportAnalysisResults(pluginSlug, analysisId);
            triggerBrowserDownload(blob, `${pluginSlug}_analysis_${analysisId}.zip`);
            showSuccess('Analysis results downloaded successfully');
        } catch (error) {
            console.error('Failed to download results:', error);
        } finally {
            setIsDownloading(false);
        }
    }, [pluginSlug, analysisId, showSuccess, pluginRepository]);

    return {
        title: plugin?.modifier?.name,
        tabs,
        activeTab,
        setActiveTab,
        activeListingSlug,
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
