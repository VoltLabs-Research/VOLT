import { getErrorMessage } from './error-codes';

const PERMISSION_DENIED_CODES = new Set([
    'Auth::Unauthorized',
    'Authentication::Unauthorized',
    'Authentication::User::AccessDenied',
    'Team::AccessDenied',
    'Team::Membership::Forbidden',
    'Team::Ownership::Forbidden',
    'Team::NotAuthorized',
    'RBAC::InsufficientPermissions',
    'Team::InsufficientPermissions',
    'AccessControlService::Access::MissingPermissions',
    'Container::AccessDenied',
    'Container::Team::AccessDenied',
    'Message::Forbidden',
    'Message:Forbidden',
    'Http::403'
]);

export default class ApiError extends Error {
    private handled = false;

    constructor(
        public readonly code: string,
        public readonly status?: number,
        public readonly originalError?: unknown
    ) {
        super(getErrorMessage(code, code));
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'ApiError';
    }

    getFriendlyMessage(): string {
        return getErrorMessage(this.code, 'Unknown error');
    }

    markHandled(): void {
        this.handled = true;
    }

    isHandled(): boolean {
        return this.handled;
    }

    isPermissionDenied(): boolean {
        return PERMISSION_DENIED_CODES.has(this.code);
    }

    static isRBACError(err: unknown): boolean {
        return err instanceof ApiError && err.isPermissionDenied();
    }

    static isCodePermissionDenied(code: string): boolean {
        return PERMISSION_DENIED_CODES.has(code);
    }
};
