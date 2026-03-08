import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';

const CANONICAL_ERROR_CODES = new Set<string>(Object.values(ErrorCodes));

export const resolveSecretKeyValidationErrorCode = (message: string): ErrorCode => {
    if (CANONICAL_ERROR_CODES.has(message)) {
        return message as ErrorCode;
    }

    return ErrorCodes.VALIDATION_INVALID_INPUT;
};
