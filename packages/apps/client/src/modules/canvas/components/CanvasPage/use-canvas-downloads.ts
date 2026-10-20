import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import useCanvasAnalysisStatus from '../../hooks/use-canvas-analysis-status';
import useDownloadTrajectoryAnalyses from '@/modules/trajectory/hooks/trajectory/use-download-trajectory-analyses';
import { useCallback, useMemo } from 'react';

import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface CanvasDownloadsParams {
    trajectory: Trajectory | null;
    analysisId?: string;
}

const useCanvasDownloads = ({ trajectory, analysisId }: CanvasDownloadsParams) => {
    const {
        downloadTrajectoryAnalyses,
        isDownloading: isDownloadingTrajectoryAnalyses
    } = useDownloadTrajectoryAnalyses();
    const { statusMap } = useCanvasAnalysisStatus({ trajectoryId: trajectory?._id });

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
        downloadAllTrajectoryAnalyses,
        canDownloadAnalysisListing,
        canDownloadTrajectoryAnalyses: Boolean(trajectory?._id) && !isDownloadingTrajectoryAnalyses
    };
};

export default useCanvasDownloads;
