// Wire response types for the early-access module — the shapes the client reads
// back from `data`.

/** Where an early-access interest submission originated. */
export type EarlyAccessSubscriptionSource = 'discover_team';

export interface CreateEarlyAccessSubscriptionResponse{
    email: string;
    teamId: string;
    teamName: string;
    alreadySubscribed: boolean;
}
