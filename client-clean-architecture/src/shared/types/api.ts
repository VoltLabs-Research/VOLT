import type { AxiosResponse } from 'axios';

export interface ApiResponse<T> {
    status: 'success';
    data: T;
}

export interface PaginatedResponse<T> {
    data: T[];
    page: {
        current: number;
        total: number;
    };
    results: {
        skipped: number;
        total: number;
        paginated: number;
    };
    status: string;
}

export enum ErrorType {
    NETWORK = 'NETWORK',
    TIMEOUT = 'TIMEOUT',
    AUTH = 'AUTH',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION = 'VALIDATION',
    CONFLICT = 'CONFLICT',
    RATE_LIMIT = 'RATE_LIMIT',
    SERVER_ERROR = 'SERVER_ERROR',
    CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
    UNKNOWN = 'UNKNOWN'
}

export type ApiAxiosResponse<T> = AxiosResponse<ApiResponse<T>>;
