import { useCallback } from 'react';

import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import queryClient from '@/shared/query/query-client';
import { removeAnalysisCaches, updateAnalysisStatusCaches } from '../services/cache';
import { analysisQuery, KEYS } from './queries';
import {
    invalidateSceneArtifacts,
    removeSceneArtifactsForAnalysisFromCache
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import type {
    AnalysisDeletedSocketPayload,
    AnalysisStatusChangedSocketPayload
} from '@/modules/socket/events/analysis';

const useAnalysisStatusSocketSync = (): void => {
    const handleStatusChanged = useCallback(({ analysisId, status, totalFrames }: AnalysisStatusChangedSocketPayload) => {
        updateAnalysisStatusCaches({
            analysisId,
            status,
            totalFrames
        });

        void queryClient.invalidateQueries({ queryKey: analysisQuery.QUERY_KEYS.lists() });
        void queryClient.invalidateQueries({ queryKey: KEYS.detail(analysisId) });
    }, []);

    const handleDeleted = useCallback(({ analysisId }: AnalysisDeletedSocketPayload) => {
        removeAnalysisCaches(analysisId);
        removeSceneArtifactsForAnalysisFromCache(analysisId);
        void analysisQuery.cache.invalidate();
        void invalidateSceneArtifacts();
    }, []);

    useSocketEvent<AnalysisStatusChangedSocketPayload>(SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED, handleStatusChanged);
    useSocketEvent<AnalysisDeletedSocketPayload>(SOCKET_ANALYSIS_EVENTS.DELETED, handleDeleted);
};

export default useAnalysisStatusSocketSync;
