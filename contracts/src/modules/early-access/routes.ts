import { post } from '../../shared/routing';
import type { CreateEarlyAccessSubscriptionInput } from './http';
import type { CreateEarlyAccessSubscriptionResponse } from './domain';

export const earlyAccessRoutes = {
    createSubscription: post<CreateEarlyAccessSubscriptionInput, CreateEarlyAccessSubscriptionResponse>('/api/early-access/teams/:teamId/subscriptions')
} as const;
