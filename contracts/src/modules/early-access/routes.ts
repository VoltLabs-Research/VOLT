import { post } from '../../shared/routing';
import type { CreateEarlyAccessSubscriptionInput } from './http';
import type { CreateEarlyAccessSubscriptionResponse } from './domain';

/**
 * The public early-access endpoint, typed by request/response. Full wire path
 * (unscoped, unauthenticated, rate-limited), matching the previous
 * `createHttpModule({ basePath: '/api/early-access', protected: false })`
 * routing verbatim.
 */
export const earlyAccessRoutes = {
    createSubscription: post<CreateEarlyAccessSubscriptionInput, CreateEarlyAccessSubscriptionResponse>('/api/early-access/teams/:teamId/subscriptions')
} as const;
