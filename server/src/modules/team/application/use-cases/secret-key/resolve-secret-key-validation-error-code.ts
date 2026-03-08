import { ErrorCodes, isErrorCode } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';

export const resolveSecretKeyValidationErrorCode = (message: string): ErrorCode => {
    if (isErrorCode(message)) {
        return message;
    }

    return ErrorCodes.VALIDATION_INVALID_INPUT;
};
