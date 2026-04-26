import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import { useCanvasAccessStore, useCanvasCanCollaborate, useCanvasDataAccess } from '@/modules/canvas/api/access';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
    AnalysisFrameLogStatus,
    AnalysisLogSegment,
    GetAnalysisFrameLogResponse
} from '@/modules/analysis/api/dtos/get-analysis-frame-log';

interface AnalysisLogChunkEvent {
    analysisId: string;
    timestep: number;
    cursor: string | null;
    segments: AnalysisLogSegment[];
    sealed: boolean;
    status: AnalysisFrameLogStatus;
    truncated: boolean;
}

interface UseAnalysisFrameLogOptions {
    analysisId?: string;
    timestep?: number;
    active?: boolean;
    live?: boolean;
}

interface UseAnalysisFrameLogResult {
    isLoading: boolean;
    error: string | null;
    segments: AnalysisLogSegment[];
    status: AnalysisFrameLogStatus;
    sealed: boolean;
    truncated: boolean;
    nextCursor: string | null;
}

const initialState: UseAnalysisFrameLogResult = {
    isLoading: false,
    error: null,
    segments: [],
    status: 'pending',
    sealed: false,
    truncated: false,
    nextCursor: null
};

const useAnalysisFrameLog = ({
    analysisId,
    timestep,
    active = true,
    live = false
}: UseAnalysisFrameLogOptions): UseAnalysisFrameLogResult => {
    const dataAccess = useCanvasDataAccess();
    const canCollaborate = useCanvasCanCollaborate();
    const effectiveLive = live && canCollaborate;
    const [state, setState] = useState<UseAnalysisFrameLogResult>(initialState);
    const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
    const cursorRef = useRef<string | null>(null);

    useEffect(() => {
        cursorRef.current = state.nextCursor;
    }, [state.nextCursor]);

    useEffect(() => {
        if (!active || !analysisId || typeof timestep !== 'number') {
            setState(initialState);
            setHasLoadedInitial(false);
            cursorRef.current = null;
            return;
        }

        let cancelled = false;

        setState((current) => ({
            ...current,
            isLoading: true,
            error: null,
            segments: [],
            status: 'pending',
            sealed: false,
            truncated: false,
            nextCursor: null
        }));
        setHasLoadedInitial(false);
        cursorRef.current = null;

        const trajectoryId = useCanvasAccessStore.getState().trajectoryId ?? '';
        dataAccess.getAnalysisFrameLog({
            trajectoryId,
            analysisId,
            timestep
        }).then((response: GetAnalysisFrameLogResponse) => {
            if (cancelled) {
                return;
            }

            cursorRef.current = response.nextCursor;
            setState({
                isLoading: false,
                error: null,
                segments: response.segments,
                status: response.status,
                sealed: response.sealed,
                truncated: response.truncated,
                nextCursor: response.nextCursor
            });
            setHasLoadedInitial(true);
        }).catch((error: unknown) => {
            if (cancelled) {
                return;
            }

            setState({
                ...initialState,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to load frame log'
            });
            setHasLoadedInitial(true);
        });

        return () => {
            cancelled = true;
        };
    }, [active, analysisId, timestep, dataAccess]);

    useSocketEvent<AnalysisLogChunkEvent>(SOCKET_ANALYSIS_EVENTS.LOG_CHUNK, (event) => {
        if (!active || event.analysisId !== analysisId || event.timestep !== timestep) {
            return;
        }

        cursorRef.current = event.cursor;
        setState((current) => ({
            ...current,
            isLoading: false,
            error: null,
            segments: current.segments.concat(event.segments),
            status: event.status,
            sealed: event.sealed,
            truncated: event.truncated,
            nextCursor: event.cursor
        }));
    }, {
        enabled: active && canCollaborate && hasLoadedInitial && !!analysisId && typeof timestep === 'number'
    });

    const liveSubscribeEnabled = active && effectiveLive && hasLoadedInitial && !!analysisId && typeof timestep === 'number';
    const liveRoomKey = liveSubscribeEnabled && analysisId && typeof timestep === 'number'
        ? `${analysisId}:${timestep}`
        : null;

    useSocketRoom({
        joinEvent: SOCKET_ANALYSIS_EVENTS.LOG_SUBSCRIBE,
        leaveEvent: SOCKET_ANALYSIS_EVENTS.LOG_UNSUBSCRIBE,
        roomKey: liveRoomKey,
        buildJoinPayload: () => (analysisId && typeof timestep === 'number')
            ? { analysisId, timestep, afterCursor: cursorRef.current ?? undefined }
            : null,
        buildLeavePayload: () => (analysisId && typeof timestep === 'number')
            ? { analysisId, timestep }
            : null,
        enabled: liveSubscribeEnabled,
        fireAndForget: true
    });

    return useMemo(() => state, [state]);
};

export default useAnalysisFrameLog;
