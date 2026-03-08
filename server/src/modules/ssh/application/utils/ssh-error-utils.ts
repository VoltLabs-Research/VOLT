import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
import type { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';
import type SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import {
    hasNumberProperty,
    hasStringProperty,
    isRecord
} from '@shared/infrastructure/utilities/type-guards';

const CANONICAL_ERROR_CODES = new Set<ErrorCode>(Object.values(ErrorCodes));

interface SSHServiceFailure {
    code: ErrorCode;
    message: string;
    statusCode: number;
}

const isCanonicalErrorCode = (value: unknown): value is ErrorCode => {
    if (typeof value !== 'string') {
        return false;
    }

    return CANONICAL_ERROR_CODES.has(value as ErrorCode);
};

const isSSHServiceFailure = (value: unknown): value is SSHServiceFailure => {
    if (!isRecord(value)) {
        return false;
    }

    if (!hasStringProperty(value, 'code') || !isCanonicalErrorCode(value.code)) {
        return false;
    }

    if (!hasStringProperty(value, 'message')) {
        return false;
    }

    if (!hasNumberProperty(value, 'statusCode')) {
        return false;
    }

    return true;
};

const getStatusCodeForErrorCode = (code: ErrorCode): number => {
    if (code === ErrorCodes.SSH_CONNECTION_NOT_FOUND || code === ErrorCodes.SSH_PATH_NOT_FOUND) {
        return 404;
    }

    if (code === ErrorCodes.VALIDATION_INVALID_INPUT) {
        return 400;
    }

    return 500;
};

const getErrorMessage = (error: unknown): string | undefined => {
    if (typeof error === 'string') {
        return error;
    }

    if (!hasStringProperty(error, 'message')) {
        return undefined;
    }

    return error.message;
};

const isDuplicateKeyError = (error: unknown): boolean => {
    if (!hasNumberProperty(error, 'code')) {
        return false;
    }

    return error.code === 11000;
};

const isValidationError = (error: unknown): boolean => {
    if (!hasStringProperty(error, 'name')) {
        return false;
    }

    return error.name === 'ValidationError';
};

export const toSafeSSHConnectionDTO = (connection: SSHConnection): SafeSSHConnectionDTO => {
    const {
        encryptedPassword,
        ...safeProps
    } = connection.props;

    return {
        _id: connection._id,
        ...safeProps
    };
};

export const resolveSSHPersistenceError = (
    error: unknown,
    duplicateMessage: string,
    validationMessage: string,
    fallbackMessage: string
): ApplicationError => {
    if (isDuplicateKeyError(error)) {
        return ApplicationError.conflict(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            duplicateMessage
        );
    }

    if (isValidationError(error)) {
        return ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            validationMessage
        );
    }

    return ApplicationError.internalServerError(fallbackMessage);
};

export const resolveSSHServiceError = (
    error: unknown,
    fallbackCode: ErrorCode,
    fallbackMessage: string
): ApplicationError => {
    if (isSSHServiceFailure(error)) {
        return new ApplicationError(
            error.code,
            error.message,
            error.statusCode
        );
    }

    const errorMessage = getErrorMessage(error);

    if (isCanonicalErrorCode(errorMessage)) {
        return new ApplicationError(
            errorMessage,
            errorMessage,
            getStatusCodeForErrorCode(errorMessage)
        );
    }

    return new ApplicationError(
        fallbackCode,
        fallbackMessage,
        getStatusCodeForErrorCode(fallbackCode)
    );
};
