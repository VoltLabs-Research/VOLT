import { useEffect, useRef, useCallback } from 'react';
import { createExternalStore, useExternalStore } from '@/modules/canvas/presentation/utils/external-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

const store = createExternalStore({ initialState: new Map<string, AnalysisStatus>() });

const setStatus = (analysisId: string, status: AnalysisStatus) => {
    const current = store.state.get(analysisId);
    if (current === status) return;
    const next = new Map(store.state);
    next.set(analysisId, status);
    store.setState(next);
};

const clearStatus = () => {
    if (store.state.size > 0) {
        store.setState(new Map());
    }
};

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const useAnalysisStatus = ({ trajectoryId, enabled = true }: UseAnalysisStatusProps) => {
    const socketService = useSocket();
    const currentTrajectoryIdRef = useRef(trajectoryId);

    const statusMap = useExternalStore(store);

    useEffect(() => {
        currentTrajectoryIdRef.current = trajectoryId;
    }, [trajectoryId]);

    const handleJobUpdate = useCallback((update: any) => {
        if (!currentTrajectoryIdRef.current) return;
        if (update.trajectoryId !== currentTrajectoryIdRef.current) return;
        if (!update.analysisId) return;

        const status = update.status as AnalysisStatus;
        if (status === 'running' || status === 'completed' || status === 'failed') {
            setStatus(update.analysisId, status);
        }
    }, []);

    useEffect(() => {
        if (!enabled || !trajectoryId) return;

        clearStatus();
        const unsubscribe = socketService.on('team.job.updated', handleJobUpdate);

        return () => {
            unsubscribe();
            clearStatus();
        };
    }, [trajectoryId, enabled, handleJobUpdate, socketService]);

    const getAnalysisStatus = useCallback((analysisId: string): AnalysisStatus | undefined => {
        return statusMap.get(analysisId);
    }, [statusMap]);

    const isAnalysisInProgress = useCallback((analysisId: string): boolean => {
        const status = statusMap.get(analysisId);
        return status === 'running' || status === 'pending';
    }, [statusMap]);

    return {
        statusMap,
        getAnalysisStatus,
        isAnalysisInProgress
    };
};

export default useAnalysisStatus;
