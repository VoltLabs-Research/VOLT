import { ERROR_CODE_MESSAGES } from '@/constants/error-codes';
import { ErrorType } from '@/types/api';

export class ApiError extends Error{
    constructor(
        public type: ErrorType,
        public code: string,
        public status?: number,
        public originalError?: any,
    ){
        super(code);
        this.code = code;
        this.name = 'ApiError';
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    /**
     * Get user-friendly message for UI display
     * Safe to show directly to end users
     */
    getUserMessage(): string{
        return ERROR_CODE_MESSAGES[this.code] || 'Unknown error';
    }
}
