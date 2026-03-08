import { ErrorCodes } from '@core/constants/error-codes';
import { createWorkerFailureEnvelope, normalizeWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

import type { ErrorCode } from '@core/constants/error-codes';
import type { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

const TRAJECTORY_WORKER_ERROR_CODE_BY_MESSAGE: Record<string, ErrorCode> = {
    UnsupportedTrajectoryFormat: ErrorCodes.TRAJECTORY_FORMAT_UNSUPPORTED,
    NativeDataParserFailed: ErrorCodes.TRAJECTORY_DATA_PARSE_FAILED,
    NativeDumpParserFailed: ErrorCodes.TRAJECTORY_DUMP_PARSE_FAILED,
    'Native stats parser failed': ErrorCodes.TRAJECTORY_STATS_PARSE_FAILED,
    'GLB Generation Failed': ErrorCodes.TRAJECTORY_GLB_GENERATION_FAILED
};

const resolveTrajectoryWorkerErrorCode = (value: unknown): ErrorCode | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
        return undefined;
    }

    if (normalizedValue === ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND) {
        return ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND;
    }

    return TRAJECTORY_WORKER_ERROR_CODE_BY_MESSAGE[normalizedValue];
};

export const normalizeTrajectoryWorkerFailure = (
    error: unknown,
    fallbackCode: ErrorCode
): WorkerFailureEnvelope => {
    const directCode = resolveTrajectoryWorkerErrorCode(error);
    if (directCode) {
        let errorDetails: string | undefined;
        if (typeof error === 'string') {
            errorDetails = error;
        }

        return createWorkerFailureEnvelope({
            code: directCode,
            details: errorDetails
        });
    }

    if (error instanceof Error) {
        const mappedCode = resolveTrajectoryWorkerErrorCode(error.message);
        if (mappedCode) {
            return createWorkerFailureEnvelope({
                code: mappedCode,
                details: error.message
            });
        }
    }

    return normalizeWorkerFailureEnvelope({
        error,
        fallbackCode
    });
};
