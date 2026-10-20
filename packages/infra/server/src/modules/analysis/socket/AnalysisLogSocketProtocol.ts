import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type {
    AnalysisExecutionLogSegment,
    AnalysisFrameLogStatus
} from '@shared/contracts/types/AnalysisFrameLog';

export const ANALYSIS_LOG_SOCKET_EVENTS = {
    SUBSCRIBE: 'subscribe_to_analysis_log',
    UNSUBSCRIBE: 'unsubscribe_from_analysis_log',
    CHUNK: 'analysis-log:chunk'
} as const;

export interface AnalysisLogChunkEventPayload {
    analysisId: string;
    timestep: number;
    cursor: string | null;
    segments: AnalysisExecutionLogSegment[];
    sealed: boolean;
    status: AnalysisFrameLogStatus;
    truncated: boolean;
}

export const getAnalysisLogRoom = (analysisId: string, timestep: number): string => {
    return `analysis-log:${analysisId}:${timestep}`;
};

export const emitAnalysisLogChunk = (payload: AnalysisLogChunkEventPayload): void => {
    socketIOEmitter.emitToRoom(
        getAnalysisLogRoom(payload.analysisId, payload.timestep),
        ANALYSIS_LOG_SOCKET_EVENTS.CHUNK,
        payload
    );
};
