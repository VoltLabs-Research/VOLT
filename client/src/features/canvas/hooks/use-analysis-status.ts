import { useEffect, useRef, useCallback, useMemo } from 'react';
import { socketService } from '@/services/websockets/socketio';
import { useSyncExternalStore } from 'react';
import type { AnalysisStatus } from '@/types/models';

interface AnalysisStatusState {
    statusByAnalysisId: Map<string, AnalysisStatus>;
    listeners: Set<() => void>;
}

const state: AnalysisStatusState = {
    statusByAnalysisId: new Map(),
    listeners: new Set(),
};

const notifyListeners = () => {
    state.listeners.forEach(l => l());
};

const updateAnalysisStatus = (analysisId: string, status: AnalysisStatus) => {
    const current = state.statusByAnalysisId.get(analysisId);
    if (current !== status) {
        state.statusByAnalysisId = new Map(state.statusByAnalysisId);
        state.statusByAnalysisId.set(analysisId, status);
        notifyListeners();
    }
};

const clearStatusForTrajectory = () => {
    if (state.statusByAnalysisId.size > 0) {
        state.statusByAnalysisId = new Map();
        notifyListeners();
    }
};

const subscribe = (listener: () => void) => {
    state.listeners.add(listener);
    return () => state.listeners.delete(listener);
};

const getSnapshot = () => state.statusByAnalysisId;

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const useAnalysisStatus = ({ trajectoryId, enabled = true }: UseAnalysisStatusProps) => {
    const isConnectedRef = useRef(socketService.isConnected());
    const currentTrajectoryIdRef = useRef(trajectoryId);

    const statusMap = useSyncExternalStore(subscribe, getSnapshot);

    useEffect(() => {
        currentTrajectoryIdRef.current = trajectoryId;
    }, [trajectoryId]);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
        });
        return unsubscribe;
    }, []);

    const handleJobUpdate = useCallback((update: any) => {
        if (!currentTrajectoryIdRef.current) return;
        if (update.trajectoryId !== currentTrajectoryIdRef.current) return;
        if (!update.analysisId) return;

        const status = update.status as AnalysisStatus;
        if (status === 'running' || status === 'completed' || status === 'failed') {
            updateAnalysisStatus(update.analysisId, status);
        }
    }, []);

    useEffect(() => {
        if (!enabled || !trajectoryId) {
            return;
        }

        clearStatusForTrajectory();

        const unsubscribe = socketService.on('team.job.updated', handleJobUpdate);

        return () => {
            unsubscribe();
            clearStatusForTrajectory();
        };
    }, [trajectoryId, enabled, handleJobUpdate]);

    const getAnalysisStatus = useCallback((analysisId: string): AnalysisStatus | undefined => {
        return statusMap.get(analysisId);
    }, [statusMap]);

    const isAnalysisInProgress = useCallback((analysisId: string): boolean => {
        const status = statusMap.get(analysisId);
        return status === 'running' || status === 'pending';
    }, [statusMap]);

    return useMemo(() => ({
        statusMap,
        getAnalysisStatus,
        isAnalysisInProgress
    }), [statusMap, getAnalysisStatus, isAnalysisInProgress]);
};

export default useAnalysisStatus;
