export { ApiError, ERROR_CODE_MESSAGES, getErrorMessage } from '@voltstack/voltclient';
export { reportError } from '@/shared/errors/core/report-error';
export {
    isAccessDeniedCode,
    isAccessDeniedError,
    isApiError,
    isHandledApiError,
    markApiErrorHandled
} from '@/shared/errors/core/report-error';
export {
    ErrorSurface
} from '@/shared/errors/core/types';
export type {
    UserFacingError,
    ReportErrorOptions
} from '@/shared/errors/core/types';
