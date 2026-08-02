import type { StoredAnalysisFrameLogRecord } from '@modules/analysis/contracts/analysis-execution-log';
import type { AnalysisExecutionLogSegment } from '@shared/contracts/types/AnalysisFrameLog';
import { Buffer } from 'node:buffer';

const MAX_LOG_BYTES = 16 * 1024 * 1024;

const TRUNCATION_NOTICE = '[Volt] Execution log truncated after reaching the frame log size limit.\n';

interface FrameLogBudgetResult {
    acceptedSegments: AnalysisExecutionLogSegment[];
    totalBytes: number;
    truncated: boolean;
}

export const measureRecordBytes = (record: StoredAnalysisFrameLogRecord): number => {
    return record.bytes
        ?? record.segments.reduce((total, segment) => total + Buffer.byteLength(segment.text, 'utf8'), 0);
};

/**
 * Accepts segments while the frame log stays under the size limit. The first segment that
 * would cross the limit is replaced by a truncation notice and the remainder is dropped.
 */
export const takeSegmentsWithinBudget = (
    record: StoredAnalysisFrameLogRecord,
    segments: AnalysisExecutionLogSegment[]
): FrameLogBudgetResult => {
    const acceptedSegments: AnalysisExecutionLogSegment[] = [];
    let totalBytes = measureRecordBytes(record);

    for (const segment of segments) {
        const nextBytes = totalBytes + Buffer.byteLength(segment.text, 'utf8');
        if (nextBytes > MAX_LOG_BYTES) {
            acceptedSegments.push({
                stream: 'system',
                text: TRUNCATION_NOTICE,
                occurredAt: new Date().toISOString()
            });

            return {
                acceptedSegments,
                totalBytes,
                truncated: true
            };
        }

        acceptedSegments.push(segment);
        totalBytes = nextBytes;
    }

    return {
        acceptedSegments,
        totalBytes,
        truncated: false
    };
};
