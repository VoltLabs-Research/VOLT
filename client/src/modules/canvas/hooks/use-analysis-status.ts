import { useMemo, useCallback } from 'react';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

interface StatusEntry {
    status: AnalysisStatus;
    trajectoryId?: string;
}

export const normalizeAnalysisStatus = (status: string | undefined): AnalysisStatus | undefined => {
    if (status === 'pending' || status === 'running' || status === 'completed' || status === 'failed') {
        return status;
    }
    return undefined;
};

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const useAnalysisStatus = ({ trajectoryId, enabled = true }: UseAnalysisStatusProps) => {
    const analysesQuery = useAnalysesByTrajectoryQuery(
        { trajectoryId: trajectoryId ?? '', page: 1, limit: 100 },
        { enabled: enabled && !!trajectoryId }
    );

    const statusMap = useMemo(() => {
        const next = new Map<string, StatusEntry>();

        for (const analysis of analysesQuery.data?.data ?? []) {
            const normalizedStatus = normalizeAnalysisStatus(analysis.status);
            if (!normalizedStatus) {
                continue;
            }

            next.set(analysis._id, {
                status: normalizedStatus,
                trajectoryId: analysis.trajectory?._id ?? trajectoryId
            });
        }

        return next;
    }, [analysesQuery.data?.data, trajectoryId]);

    const getAnalysisStatus = useCallback((analysisId: string): AnalysisStatus | undefined => {
        return statusMap.get(analysisId)?.status;
    }, [statusMap]);

    const isAnalysisInProgress = useCallback((analysisId: string): boolean => {
        const status = statusMap.get(analysisId)?.status;
        return status === 'running' || status === 'pending';
    }, [statusMap]);

    return {
        statusMap,
        getAnalysisStatus,
        isAnalysisInProgress
    };
};

export default useAnalysisStatus;
