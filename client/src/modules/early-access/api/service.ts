import { createService, post } from '@/app/core/http/utilities/create-service';

export enum EarlyAccessSubscriptionSource {
    DiscoverTeam = 'discover_team'
}

export interface CreateEarlyAccessSubscriptionInput {
    teamId: string;
    email: string;
    source?: EarlyAccessSubscriptionSource;
    referrer?: string;
}

export interface CreateEarlyAccessSubscriptionResponse {
    email: string;
    teamId: string;
    teamName: string;
    alreadySubscribed: boolean;
}

const endpoints = {
    createSubscription: post<
        CreateEarlyAccessSubscriptionInput,
        CreateEarlyAccessSubscriptionResponse
    >('/teams/:teamId/subscriptions', {
        omit: ['teamId']
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/early-access',
            useRBAC: false
        }
    }
}, endpoints);
