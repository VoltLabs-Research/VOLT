import { getErrorMessage } from './error-codes';

const PERMISSION_DENIED_CODES = new Set([
    'RBAC::InsufficientPermissions',
    'Team::InsufficientPermissions',
    'AccessControlService::Access::MissingPermissions'
]);

export default class ApiError extends Error{
    constructor(
        public readonly code: string,
        public readonly status?: number,
        public readonly originalError?: unknown
    ){
        super(getErrorMessage(code, code));
        this.name = 'ApiError';
    }

    getFriendlyMessage(): string{
        return getErrorMessage(this.code, 'Unknown error');
    }

    isPermissionDenied(): boolean{
        return PERMISSION_DENIED_CODES.has(this.code);
    }

    static isRBACError(err: unknown): boolean{
        return err instanceof ApiError && err.isPermissionDenied();
    }

    static isCodePermissionDenied(code: string): boolean{
        return PERMISSION_DENIED_CODES.has(code);
    }
};
