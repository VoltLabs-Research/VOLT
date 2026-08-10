import { ANALYSIS_LISTING_DOWNLOAD_MODAL_ID } from '../AnalysisListingDownloadModal';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import useCanvasAnalysisStatus from '../../hooks/use-canvas-analysis-status';
import useDownloadPluginListing from '../../hooks/use-download-plugin-listing';
import useDownloadTrajectoryAnalyses from '@/modules/trajectory/hooks/trajectory/use-download-trajectory-analyses';
import { openModal } from '@/shared/ui/modal';
import { useCallback, useMemo, useState } from 'react';

import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface CanvasDownloadsParams {
    trajectory: Trajectory | null;
    analysisId?: string;
}

/**
 * Exposure listings, per-analysis listings (through the selection modal) and the
 * full trajectory bundle, plus whether each download is currently available.
 */
const useCanvasDownloads = ({ trajectory, analysisId }: CanvasDownloadsParams) => {
    const { downloadListing, downloadAnalysisListings, isDownloading } = useDownloadPluginListing();
    const {
        downloadTrajectoryAnalyses,
        isDownloading: isDownloadingTrajectoryAnalyses
    } = useDownloadTrajectoryAnalyses();
    const { statusMap } = useCanvasAnalysisStatus({ trajectoryId: trajectory?._id });
    const [analysisDownloadTargetId, setAnalysisDownloadTargetId] = useState<string | null>(null);

    const openAnalysisDownloadModal = useCallback((targetAnalysisId?: string) => {
        const resolvedAnalysisId = targetAnalysisId ?? analysisId;
        if (!resolvedAnalysisId) {
            return;
        }

        setAnalysisDownloadTargetId(resolvedAnalysisId);
        openModal(ANALYSIS_LISTING_DOWNLOAD_MODAL_ID);
    }, [analysisId]);

    const closeAnalysisDownloadModal = useCallback(() => {
        setAnalysisDownloadTargetId(null);
    }, []);

    const downloadAllTrajectoryAnalyses = useCallback(() => {
        if (!trajectory?._id) {
            return;
        }

        void downloadTrajectoryAnalyses({
            trajectoryId: trajectory._id,
            filename: trajectory.name
        });
    }, [downloadTrajectoryAnalyses, trajectory?._id, trajectory?.name]);

    const canDownloadAnalysisListing = useMemo(() => {
        if (!analysisId) {
            return false;
        }

        const selectedAnalysis = findCachedAnalysisById({
            analysisId,
            trajectoryId: trajectory?._id,
            fallbackAnalyses: trajectory?.analysis
        });
        const status = statusMap.get(analysisId)?.status ?? normalizeCanvasAnalysisStatus(selectedAnalysis?.status);

        return status === CanvasAnalysisStatusEnum.Completed;
    }, [analysisId, statusMap, trajectory?._id, trajectory?.analysis]);

    return {
        isDownloading,
        downloadListing,
        downloadAnalysisListings,
        analysisDownloadTargetId,
        openAnalysisDownloadModal,
        closeAnalysisDownloadModal,
        downloadAllTrajectoryAnalyses,
        canDownloadAnalysisListing,
        canDownloadTrajectoryAnalyses: Boolean(trajectory?._id) && !isDownloadingTrajectoryAnalyses
    };
};

export default useCanvasDownloads;
