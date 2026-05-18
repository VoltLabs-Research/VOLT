import { createService, post } from '@/app/core/http/utilities/create-service';

export enum EarlyAccessSubscriptionSource {
    DiscoverTeam = 'discover_team'
}

export interface CreateEarlyAccessSubscriptionInputDTO {
    teamId: string;
    email: string;
    source?: EarlyAccessSubscriptionSource;
    referrer?: string;
}

export interface CreateEarlyAccessSubscriptionOutputDTO {
    email: string;
    teamId: string;
    teamName: string;
    alreadySubscribed: boolean;
}

const endpoints = {
    createSubscription: post<
        CreateEarlyAccessSubscriptionInputDTO,
        CreateEarlyAccessSubscriptionOutputDTO
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
