import { ErrorType } from '@/types/api';
import { buildUserMessage } from '@/utilities/user-friendly-errors';

export interface ApiErrorContext {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    statusText?: string;
    errorMessage?: string;
    serverMessage?: string;
    resourceId?: string;
    timestamp?: string;
    [key: string]: any;
}

export class ApiError extends Error{
    context: ApiErrorContext = {};

    constructor(
        public type: ErrorType,
        message: string,
        public status?: number,
        public originalError?: any,
        context?: ApiErrorContext
    ){
        super(message);
        this.name = 'ApiError';
        this.context = context || {};
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    /**
     * Get detailed message for developers (includes context, endpoint, status, etc.)
     */
    getDetailedMessage(): string {
        const parts = [this.message];
        
        if (this.context.endpoint) parts.push(`[${this.context.method || 'HTTP'} ${this.context.endpoint}]`);
        if (this.context.statusCode) parts.push(`Status: ${this.context.statusCode}`);
        if (this.context.serverMessage) parts.push(`Server: ${this.context.serverMessage}`);
        if (this.context.resourceId) parts.push(`Resource: ${this.context.resourceId}`);
        
        return parts.join(' | ');
    }

    /**
     * Get user-friendly message for UI display
     * Safe to show directly to end users
     */
    getUserMessage(): string {
        return buildUserMessage(this.type, this.context);
    }

    isRetryable(): boolean{
        return [
            ErrorType.NETWORK,
            ErrorType.TIMEOUT,
            ErrorType.RATE_LIMIT,
            ErrorType.SERVER_ERROR
        ].includes(this.type);
    }

    isAuthError(): boolean{
        return this.type === ErrorType.AUTH;
    }

    isForbidden(): boolean{
        return this.type === ErrorType.FORBIDDEN;
    }

    isCircuitOpen(): boolean{
        return this.type === ErrorType.CIRCUIT_BREAKER_OPEN;
    }
}