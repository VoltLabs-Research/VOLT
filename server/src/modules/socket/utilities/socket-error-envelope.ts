import { ErrorCodes, isErrorCode } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';

export interface SocketErrorEnvelope {
    code: ErrorCode;
    message: ErrorCode;
    details?: string;
}

const resolveSocketErrorCode = (value: unknown): ErrorCode => {
    if (isErrorCode(value)) {
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
