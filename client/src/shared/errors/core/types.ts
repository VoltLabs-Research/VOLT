export enum ErrorKind {
    Api = 'api',
    Permission = 'permission',
    Validation = 'validation',
    Network = 'network',
    Auth = 'auth',
    NotFound = 'not-found',
    Conflict = 'conflict',
    RateLimit = 'rate-limit',
    Server = 'server',
    Unknown = 'unknown'
};

export enum ErrorSurface {
    Toast = 'toast',
    Inline = 'inline',
    Page = 'page',
    Silent = 'silent'
};

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
