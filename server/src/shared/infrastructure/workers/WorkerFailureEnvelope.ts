import { ErrorCodes, isErrorCode } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type { ErrorCode } from '@core/constants/error-codes';

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

interface ApplicationErrorFailureDetails {
    failure?: unknown;
}

interface NormalizeWorkerFailureEnvelopeOptions {
    failure?: unknown;
    error?: unknown;
    fallbackCode?: ErrorCode;
    fallbackDetails?: string;
}

interface WorkerFailureEnvelopeInput {
    code?: ErrorCode;
    details?: string;
}

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

const readApplicationErrorFailure = (error: ApplicationError): WorkerFailureEnvelope | undefined => {
    const details = error.details as ApplicationErrorFailureDetails | undefined;
    if (!isWorkerFailureEnvelopeRecord(details?.failure) || !isErrorCode(details.failure.code)) {
        return undefined;
    }

    return createWorkerFailureEnvelope({
        code: details.failure.code,
        details: resolveStringDetails(details.failure.details)
    });
};

export const createWorkerFailureEnvelope = (options?: WorkerFailureEnvelopeInput): WorkerFailureEnvelope => {
    const code = options?.code || ErrorCodes.WORKER_FAILURE;

    return {
        code,
        message: code,
        details: resolveStringDetails(options?.details)
    };
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

    if (options.error instanceof ApplicationError) {
        const applicationFailure = readApplicationErrorFailure(options.error);
        if (applicationFailure) {
            return createWorkerFailureEnvelope({
                code: applicationFailure.code,
                details: applicationFailure.details || options.fallbackDetails
            });
        }

        if (isErrorCode(options.error.code)) {
            return createWorkerFailureEnvelope({
                code: options.error.code,
                details: resolveStringDetails(options.error.message) || options.fallbackDetails
            });
        }
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

