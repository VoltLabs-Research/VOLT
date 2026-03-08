import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { useCallback, useMemo } from 'react';
import { AnalysisStatus, isCanvasAnalysisInProgress } from '../utilities/analysis-status';

import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { CanvasAnalysisStatusEntry } from '../utilities/analysis-status';

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
};

const useAnalysisStatus = ({ trajectoryId, enabled = true }: UseAnalysisStatusProps) => {
    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: enabled && !!trajectoryId }
    );
    const analyses = ((analysesQuery.data as { data?: Analysis[] } | undefined)?.data ?? []);

    const statusMap = useMemo(() => {
        const next = new Map<string, CanvasAnalysisStatusEntry>();

        for (const analysis of analyses) {
            next.set(analysis._id, {
                status: analysis.status as AnalysisStatus,
                trajectoryId: analysis.trajectory?._id ?? trajectoryId
            });
        }

        return next;
    }, [analyses, trajectoryId]);

    const getAnalysisStatus = useCallback((analysisId: string): AnalysisStatus | undefined => {
        return statusMap.get(analysisId)?.status;
    }, [statusMap]);

    const isAnalysisInProgress = useCallback((analysisId: string): boolean => {
        return isCanvasAnalysisInProgress(statusMap.get(analysisId)?.status);
    }, [statusMap]);

    return {
        statusMap,
        getAnalysisStatus,
        isAnalysisInProgress
    };
};

export default useAnalysisStatus;
