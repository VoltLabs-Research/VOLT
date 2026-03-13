export {
    isAccessDeniedCode,
    isAccessDeniedError,
    isApiError,
    isHandledApiError,
    markApiErrorHandled
} from '@/shared/errors/core/api-error-guards';
export { normalizeError } from '@/shared/errors/core/normalize-error';
export { mapErrorToUserMessage } from '@/shared/errors/core/map-error-to-user-message';
export { reportError } from '@/shared/errors/core/report-error';
export { executeTask } from '@/shared/errors/core/execute-task';
export {
    ErrorKind,
    ErrorSurface
} from '@/shared/errors/core/types';
export type {
    AppError,
    UserFacingError,
    ReportErrorOptions,
    ExecuteTaskOptions
} from '@/shared/errors/core/types';
