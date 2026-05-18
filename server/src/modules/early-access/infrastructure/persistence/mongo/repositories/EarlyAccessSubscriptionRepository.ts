import EarlyAccessSubscription, {
    EarlyAccessSubscriptionProps
} from '@modules/early-access/domain/entities/EarlyAccessSubscription';
import earlyAccessSubscriptionMapper from '@modules/early-access/infrastructure/persistence/mongo/mappers/EarlyAccessSubscriptionMapper';
import EarlyAccessSubscriptionModel, {
    EarlyAccessSubscriptionDocument
} from '@modules/early-access/infrastructure/persistence/mongo/models/EarlyAccessSubscriptionModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

type RecordInterestInput = Pick<
    EarlyAccessSubscriptionProps,
    'team' | 'email' | 'source' | 'referrer' | 'lastSubmittedAt'
>;

interface RecordInterestResult {
    subscription: EarlyAccessSubscription;
    alreadySubscribed: boolean;
}

const isDuplicateKeyError = (error: unknown): boolean => {
    return Boolean(
        error
        && typeof error === 'object'
        && 'code' in error
        && Reflect.get(error, 'code') === 11000
    );
};

@Singleton()
export default class EarlyAccessSubscriptionRepository
    extends MongooseBaseRepository<EarlyAccessSubscription, EarlyAccessSubscriptionProps, EarlyAccessSubscriptionDocument> {

    constructor() {
        super(EarlyAccessSubscriptionModel, earlyAccessSubscriptionMapper);
    }

    async findByTeamAndEmail(teamId: string, email: string): Promise<EarlyAccessSubscription | null> {
        return this.findOne({
            team: teamId,
            email
        });
    }

    async recordInterest(input: RecordInterestInput): Promise<RecordInterestResult> {
        const existing = await this.findByTeamAndEmail(input.team, input.email);

        if (existing) {
            const updated = await this.updateById(existing.id, {
                source: input.source,
                referrer: input.referrer,
                lastSubmittedAt: input.lastSubmittedAt
            });

            return {
                subscription: updated ?? existing,
                alreadySubscribed: true
            };
        }

        try {
            const subscription = await this.create(input);
            return {
                subscription,
                alreadySubscribed: false
            };
        } catch (error) {
            if (!isDuplicateKeyError(error)) {
                throw error;
            }

            const subscription = await this.findByTeamAndEmail(input.team, input.email);
            if (!subscription) {
                throw error;
            }

            return {
                subscription,
                alreadySubscribed: true
            };
        }
    }
}
