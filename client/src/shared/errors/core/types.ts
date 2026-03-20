export enum ErrorSurface {
    Toast = 'toast',
    Silent = 'silent'
};

export interface UserFacingError {
    title: string;
    description?: string;
    surface: ErrorSurface;
};

export interface ReportErrorOptions {
    surface?: ErrorSurface;
    fallbackTitle?: string;
    fallbackDescription?: string;
    onError?: (userError: UserFacingError) => void;
};
