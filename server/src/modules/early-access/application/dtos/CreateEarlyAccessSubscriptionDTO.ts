import type { EarlyAccessSubscriptionSource } from '@modules/early-access/domain/entities/EarlyAccessSubscription';

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
