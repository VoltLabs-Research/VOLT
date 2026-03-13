export type ErrorKind =
    | 'api'
    | 'permission'
    | 'validation'
    | 'network'
    | 'auth'
    | 'not-found'
    | 'conflict'
    | 'rate-limit'
    | 'server'
    | 'unknown';

export type ErrorSurface = 'toast' | 'inline' | 'page' | 'silent';

export interface AppError {
    kind: ErrorKind;
    code: string | null;
    httpStatus: number | null;
    message: string;
    friendlyMessage: string;
    retryable: boolean;
    fieldErrors?: Record<string, string>;
    original: unknown;
};

export interface UserFacingError {
    title: string;
    description?: string;
    actionLabel?: string;
    retryable: boolean;
    surface: ErrorSurface;
    fieldErrors?: Record<string, string>;
};

export interface ReportErrorOptions {
    surface?: ErrorSurface;
    context?: string;
    fallbackTitle?: string;
    fallbackDescription?: string;
    onError?: (userError: UserFacingError) => void;
};

export interface ExecuteTaskOptions<T> extends ReportErrorOptions {
    action: Promise<T> | (() => Promise<T>);
    onSuccess?: (result: T) => void | Promise<void>;
    rethrow?: boolean;
};
