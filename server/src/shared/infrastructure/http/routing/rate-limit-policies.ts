import {
    createStandardRateLimiter
} from '@shared/infrastructure/http/middleware/rate-limit';

export const RATE_LIMIT_POLICIES = {
    authPublic: createStandardRateLimiter(15),
    passwordUpdate: createStandardRateLimiter(5, 'Too many password attempts, please try again later'),
    passwordConfirmedClusterAction: createStandardRateLimiter(
        5,
        'Too many cluster confirmation attempts, please try again later'
    )
};
