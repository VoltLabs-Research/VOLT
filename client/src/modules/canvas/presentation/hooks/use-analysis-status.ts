import { useEffect, useRef, useCallback } from 'react';
import { createExternalStore, useExternalStore } from '../utilities/external-store';
import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

const store = createExternalStore({ initialState: new Map<string, AnalysisStatus>() });

const setStatus = (analysisId: string, status: AnalysisStatus) => {
    const snapshot = store.getSnapshot();
    const current = snapshot.get(analysisId);
    if (current === status) return;
    const next = new Map(snapshot);
    next.set(analysisId, status);
    store.setState(next);
};

const clearStatus = () => {
    if (store.getSnapshot().size > 0) {
        store.setState(new Map());
    }
};

const normalizeStatus = (status: string | undefined): AnalysisStatus | undefined => {
    if (status === 'pending' || status === 'running' || status === 'completed' || status === 'failed') {
        return status;
    }
    return undefined;
};

export const seedAnalysisStatuses = (items: Array<{ analysisId: string; status?: string }>) => {
    if (!items.length) {
        return;
    }

    const snapshot = store.getSnapshot();
    const next = new Map(snapshot);
    let changed = false;

    for (const item of items) {
        const normalized = normalizeStatus(item.status);
        if (!item.analysisId || !normalized) {
            continue;
        }
        if (next.get(item.analysisId) === normalized) {
            continue;
        }
        next.set(item.analysisId, normalized);
        changed = true;
    }

    if (changed) {
        store.setState(next);
    }
};

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const useAnalysisStatus = ({ trajectoryId, enabled = true }: UseAnalysisStatusProps) => {
    const currentTrajectoryIdRef = useRef(trajectoryId);

    const statusMap = useExternalStore(store);

    useEffect(() => {
        currentTrajectoryIdRef.current = trajectoryId;
    }, [trajectoryId]);

    const handleJobUpdate = useCallback((update: any) => {
        if (!currentTrajectoryIdRef.current) return;
        if (update.trajectoryId !== currentTrajectoryIdRef.current) return;
        if (!update.analysisId) return;

        const status = normalizeStatus(update.status);
        if (status === 'running' || status === 'completed' || status === 'failed') {
            setStatus(update.analysisId, status);
        }
    }, []);

    useEffect(() => {
        if (enabled && trajectoryId) {
            clearStatus();
        }
        return () => {
            if (enabled && trajectoryId) {
                clearStatus();
            }
        };
    }, [trajectoryId, enabled]);

    useSocketEvent('team.job.updated', handleJobUpdate, { enabled: enabled && !!trajectoryId });

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
