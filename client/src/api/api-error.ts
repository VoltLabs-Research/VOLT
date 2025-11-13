import { ErrorType } from '@/types/api';

export class ApiError extends Error{
    constructor(
        public type: ErrorType,
        message: string,
        public status?: number,
        public originalError?: any
    ){
        super(message);
        this.name = 'ApiError';
        Object.setPrototypeOf(this, ApiError.prototype);
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