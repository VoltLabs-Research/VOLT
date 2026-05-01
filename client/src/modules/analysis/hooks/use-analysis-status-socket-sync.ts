import { useCallback } from 'react';

import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import queryClient from '@/shared/infrastructure/query/query-client';
import { updateAnalysisStatusCaches } from '../services/cache';
import { analysisQuery, KEYS } from './queries';

const readNumber = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const useAnalysisStatusSocketSync = (): void => {
    const handleStatusChanged = useCallback((payload: Record<string, unknown>) => {
        const analysisId = typeof payload.analysisId === 'string' ? payload.analysisId : '';
        const status = typeof payload.status === 'string' ? payload.status : '';

        if (!analysisId || !status) {
            return;
        }

        updateAnalysisStatusCaches({
            analysisId,
            status,
            completedFrames: readNumber(payload.completedFrames),
            totalFrames: readNumber(payload.totalFrames)
        });

        void queryClient.invalidateQueries({ queryKey: analysisQuery.QUERY_KEYS.lists() });
        void queryClient.invalidateQueries({ queryKey: KEYS.byTrajectory() });
        void queryClient.invalidateQueries({ queryKey: KEYS.detail(analysisId) });
    }, []);

    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED, handleStatusChanged);
};

export default useAnalysisStatusSocketSync;
