

import type { EarlyAccessSubscriptionSource } from './domain';

export interface CreateEarlyAccessSubscriptionInput{
    email: string;
    source?: EarlyAccessSubscriptionSource;
    referrer?: string;
}
