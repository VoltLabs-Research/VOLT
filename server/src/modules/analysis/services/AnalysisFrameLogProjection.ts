import type {
    GetFrameLogInput,
    StoredAnalysisFrameLogRecord
} from '@modules/analysis/contracts/analysis-execution-log';
import type { AnalysisFrameLogSnapshot } from '@shared/contracts/types/AnalysisFrameLog';

/**
 * Cursors are the number of segments emitted so far. An already published cursor wins over the
 * current segment count so a frame never rewinds its cursor.
 */
export const resolveFrameLogCursor = (value: string | null, segmentCount: number): string | null => {
    if (value) {
        return value;
    }

    return segmentCount > 0 ? `${segmentCount}` : null;
};

const parseCursorOffset = (cursor: string): number | null => {
    if (!/^\d+$/.test(cursor)) {
        return null;
    }

    return Number.parseInt(cursor, 10);
};

export const buildPendingFrameLogSnapshot = (input: GetFrameLogInput): AnalysisFrameLogSnapshot => ({
    analysisId: input.analysisId,
    teamId: input.teamId,
    trajectoryId: input.trajectoryId,
    timestep: input.timestep,
    status: 'pending',
    sealed: false,
    truncated: false,
    nextCursor: input.afterCursor || null,
    segments: []
});

export const buildFrameLogSnapshot = (
    record: StoredAnalysisFrameLogRecord,
    afterCursor?: string
): AnalysisFrameLogSnapshot => {
    const replayOffset = afterCursor ? parseCursorOffset(afterCursor) : 0;

    return {
        analysisId: record.analysisId,
        teamId: record.teamId,
        trajectoryId: record.trajectoryId,
        timestep: record.timestep,
        status: record.status,
        sealed: record.sealed,
        truncated: record.truncated,
        nextCursor: resolveFrameLogCursor(record.nextCursor, record.segments.length) ?? (afterCursor || null),
        segments: replayOffset === null ? [] : record.segments.slice(replayOffset)
    };
};
