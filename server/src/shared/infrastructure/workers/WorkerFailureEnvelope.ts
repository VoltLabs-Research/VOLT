import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

const AVAILABLE_ERROR_CODES = new Set<ErrorCode>(Object.values(ErrorCodes));

export interface WorkerFailureEnvelope {
    code: ErrorCode;
    message: ErrorCode;
    details?: string;
}

interface WorkerFailureEnvelopeRecord {
    code?: unknown;
    message?: unknown;
    details?: unknown;
}

export interface NormalizeWorkerFailureEnvelopeOptions {
    failure?: unknown;
    error?: unknown;
    fallbackCode?: ErrorCode;
    fallbackDetails?: string;
}

export interface CreateWorkerFailureMessageOptions {
    jobId: string;
    failure: WorkerFailureEnvelope;
    metadata?: Record<string, unknown>;
}

export interface WorkerFailureMessage extends Record<string, unknown> {
    status: 'failed';
    jobId: string;
    error: string;
    failure: WorkerFailureEnvelope;
}

export const isErrorCode = (value: unknown): value is ErrorCode => {
    if (typeof value !== 'string') {
        return false;
    }

    return AVAILABLE_ERROR_CODES.has(value as ErrorCode);
};

const isWorkerFailureEnvelopeRecord = (value: unknown): value is WorkerFailureEnvelopeRecord => {
    return isRecord(value);
};

const resolveStringDetails = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
        return undefined;
    }

    return normalizedValue;
};

export const createWorkerFailureEnvelope = (options?: {
    code?: ErrorCode;
    details?: string;
}): WorkerFailureEnvelope => {
    const code = options?.code || ErrorCodes.WORKER_FAILURE;

    return {
        code,
        message: code,
        details: resolveStringDetails(options?.details)
    };
};

export const getWorkerFailureErrorMessage = (failure: WorkerFailureEnvelope): string => {
    const details = resolveStringDetails(failure.details);
    if (details) {
        return details;
    }

    return failure.message;
};

export const normalizeWorkerFailureEnvelope = (
    options: NormalizeWorkerFailureEnvelopeOptions = {}
): WorkerFailureEnvelope => {
    const fallbackCode = options.fallbackCode || ErrorCodes.WORKER_FAILURE;

    if (isWorkerFailureEnvelopeRecord(options.failure) && isErrorCode(options.failure.code)) {
        return createWorkerFailureEnvelope({
            code: options.failure.code,
            details: resolveStringDetails(options.failure.details) || options.fallbackDetails
        });
    }

    if (options.error instanceof WorkerFailureError) {
        return createWorkerFailureEnvelope({
            code: options.error.failure.code,
            details: options.error.failure.details || options.fallbackDetails
        });
    }

    if (isWorkerFailureEnvelopeRecord(options.error) && isErrorCode(options.error.code)) {
        return createWorkerFailureEnvelope({
            code: options.error.code,
            details: resolveStringDetails(options.error.details) || options.fallbackDetails
        });
    }

    const directDetails = resolveStringDetails(options.error);
    if (directDetails && isErrorCode(directDetails)) {
        return createWorkerFailureEnvelope({
            code: directDetails
        });
    }

    if (options.error instanceof Error) {
        const errorMessage = resolveStringDetails(options.error.message);
        if (errorMessage && isErrorCode(errorMessage)) {
            return createWorkerFailureEnvelope({
                code: errorMessage,
                details: options.fallbackDetails
            });
        }

        return createWorkerFailureEnvelope({
            code: fallbackCode,
            details: errorMessage || options.fallbackDetails
        });
    }

    return createWorkerFailureEnvelope({
        code: fallbackCode,
        details: directDetails || options.fallbackDetails
    });
};

export const createWorkerFailureMessage = (
    options: CreateWorkerFailureMessageOptions
): WorkerFailureMessage => {
    const metadata = options.metadata || {};

    return {
        ...metadata,
        status: 'failed',
        jobId: options.jobId,
        error: getWorkerFailureErrorMessage(options.failure),
        failure: options.failure
    };
};

export class WorkerFailureError extends Error {
    public readonly failure: WorkerFailureEnvelope;

    constructor(failure: WorkerFailureEnvelope) {
        super(getWorkerFailureErrorMessage(failure));
        this.name = 'WorkerFailureError';
        this.failure = failure;
    }
}
