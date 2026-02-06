import { getErrorMessage } from './error-codes';

export default class ApiError extends Error{
    constructor(
        public readonly code: string,
        public readonly status?: number,
        public readonly originalError?: unknown
    ){
        super(code);
        this.name = 'ApiError';
    }

    getFriendlyMessage(): string{
        return getErrorMessage(this.code, "Unknown error");
    }
};