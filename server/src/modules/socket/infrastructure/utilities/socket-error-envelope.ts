import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

const SOCKET_ERROR_CODES = new Set<ErrorCode>(Object.values(ErrorCodes));

export interface SocketErrorEnvelope {
    code: ErrorCode;
    message: ErrorCode;
    details?: string;
}

export const isSocketErrorCode = (value: unknown): value is ErrorCode => {
    if (typeof value !== 'string') {
        return false;
    }

    return SOCKET_ERROR_CODES.has(value as ErrorCode);
};

export const resolveSocketErrorCode = (value: unknown): ErrorCode => {
    if (isSocketErrorCode(value)) {
        return value;
    }

    return ErrorCodes.INTERNAL_SERVER_ERROR;
};

export const createSocketErrorEnvelope = (
    code: unknown,
    details?: string
): SocketErrorEnvelope => {
    const resolvedCode = resolveSocketErrorCode(code);
    const errorEnvelope: SocketErrorEnvelope = {
        code: resolvedCode,
        message: resolvedCode
    };

    if (details) {
        errorEnvelope.details = details;
    }

    return errorEnvelope;
};

export const createSocketErrorEnvelopeFromApplicationError = (
    error: ApplicationError
): SocketErrorEnvelope => {
    const code = resolveSocketErrorCode(error.code);
    let details: string | undefined;

    if (error.message && error.message !== code) {
        details = error.message;
    }

    return createSocketErrorEnvelope(code, details);
};
