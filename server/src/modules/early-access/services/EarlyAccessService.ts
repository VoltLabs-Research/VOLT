import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import TeamModel from '@modules/team/models/team/TeamModel';
import EarlyAccessSubscriptionModel, {
    EarlyAccessSubscriptionSource
} from '@modules/early-access/models/EarlyAccessSubscriptionModel';
import type { IEarlyAccessSubscription } from '@modules/early-access/models/EarlyAccessSubscriptionModel';
import type { CreateEarlyAccessSubscriptionInput } from '@volt/contracts/modules/early-access/http';
import type { CreateEarlyAccessSubscriptionResponse } from '@volt/contracts/modules/early-access/domain';
import mongoose from 'mongoose';
import type { HydratedDocument } from 'mongoose';

type SubscriptionDoc = HydratedDocument<IEarlyAccessSubscription>;

interface RecordInterestInput {
    team: mongoose.Types.ObjectId;
    email: string;
    source: EarlyAccessSubscriptionSource;
    referrer?: string;
    lastSubmittedAt: Date;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isDuplicateKeyError = (error: unknown): boolean =>
    Boolean(error && typeof error === 'object' && 'code' in error && Reflect.get(error, 'code') === 11000);

/**
 * The single application service for the early-access module (pollium style):
 * holds the whole create-subscription use case, `new`ed by the controller, and
 * talks to the Mongoose {@link EarlyAccessSubscriptionModel} / TeamModel
 * directly — no repository, entity, mapper, use case or DI. Throws typed
 * {@link ApplicationError}s (no Result channel).
 */
export default class EarlyAccessService {
    async createSubscription(teamId: string, input: CreateEarlyAccessSubscriptionInput): Promise<CreateEarlyAccessSubscriptionResponse> {
        const team = await TeamModel.findById(teamId).select('name').exec();
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const email = normalizeEmail(input.email);
        const referrer = input.referrer?.trim() || undefined;
        const source = (input.source as EarlyAccessSubscriptionSource | undefined) ?? EarlyAccessSubscriptionSource.DiscoverTeam;

        const { subscription, alreadySubscribed } = await this.#recordInterest({
            team: team._id as mongoose.Types.ObjectId,
            email,
            source,
            referrer,
            lastSubmittedAt: new Date()
        });

        return {
            email: subscription.email,
            teamId: String(team._id),
            teamName: team.name,
            alreadySubscribed
        };
    }

    async #recordInterest(input: RecordInterestInput): Promise<{ subscription: SubscriptionDoc; alreadySubscribed: boolean }> {
        const existing = await EarlyAccessSubscriptionModel.findOne({ team: input.team, email: input.email });

        if (existing) {
            existing.source = input.source;
            existing.referrer = input.referrer;
            existing.lastSubmittedAt = input.lastSubmittedAt;
            await existing.save();
            return { subscription: existing, alreadySubscribed: true };
        }

        try {
            const subscription = await EarlyAccessSubscriptionModel.create(input);
            return { subscription, alreadySubscribed: false };
        } catch (error) {
            if (!isDuplicateKeyError(error)) {
                throw error;
            }

            const subscription = await EarlyAccessSubscriptionModel.findOne({ team: input.team, email: input.email });
            if (!subscription) {
                throw error;
            }

            return { subscription, alreadySubscribed: true };
        }
    }
}
