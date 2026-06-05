import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type EarlyAccessSubscription from '@modules/early-access/domain/entities/EarlyAccessSubscription';
import type { EarlyAccessSubscriptionProps } from '@modules/early-access/domain/entities/EarlyAccessSubscription';

export type RecordInterestInput = Pick<
    EarlyAccessSubscriptionProps,
    'team' | 'email' | 'source' | 'referrer' | 'lastSubmittedAt'
>;

export interface RecordInterestResult {
    subscription: EarlyAccessSubscription;
    alreadySubscribed: boolean;
}

export interface IEarlyAccessSubscriptionRepository extends IBaseRepository<EarlyAccessSubscription, EarlyAccessSubscriptionProps> {
    findByTeamAndEmail(teamId: string, email: string): Promise<EarlyAccessSubscription | null>;
    recordInterest(input: RecordInterestInput): Promise<RecordInterestResult>;
}
