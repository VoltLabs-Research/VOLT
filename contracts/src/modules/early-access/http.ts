// Wire request bodies the CLIENT sends. The `:teamId` path param is server
// context, not part of the body.

import type { EarlyAccessSubscriptionSource } from './domain';

export interface CreateEarlyAccessSubscriptionInput{
    email: string;
    source?: EarlyAccessSubscriptionSource;
    referrer?: string;
}
