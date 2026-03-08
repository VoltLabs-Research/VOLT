import rateLimit from 'express-rate-limit';

interface RateLimitOptions {
    windowMs?: number;
    max: number;
    message?: string;
};

export const STANDARD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const createRateLimiter = (options: RateLimitOptions) => {
    return rateLimit({
        windowMs: options.windowMs ?? STANDARD_RATE_LIMIT_WINDOW_MS,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            status: 'error',
            message: options.message ?? 'Too many requests, please try again later'
        }
    });
};

export const createStandardRateLimiter = (max: number, message?: string) => {
    return createRateLimiter({
        windowMs: STANDARD_RATE_LIMIT_WINDOW_MS,
        max,
        message
    });
};

export const createBurstRateLimiter = (max: number, windowMs: number, message?: string) => {
    return createRateLimiter({
        max,
        windowMs,
        message
    });
};

export const createGeneralRateLimiter = (max: number, message?: string) => {
    return createStandardRateLimiter(max, message);
};

export const createExportRateLimiter = (max: number, message?: string) => {
    return createStandardRateLimiter(max, message);
};
