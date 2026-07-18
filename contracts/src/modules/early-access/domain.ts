

export type EarlyAccessSubscriptionSource = 'discover_team';

export interface CreateEarlyAccessSubscriptionResponse{
    email: string;
    teamId: string;
    teamName: string;
    alreadySubscribed: boolean;
}
