import {
    CreateEarlyAccessSubscriptionInputDTO,
    CreateEarlyAccessSubscriptionOutputDTO
} from '@modules/early-access/application/dtos/CreateEarlyAccessSubscriptionDTO';
import EarlyAccessSubscription, {
    EarlyAccessSubscriptionSource
} from '@modules/early-access/domain/entities/EarlyAccessSubscription';
import EarlyAccessSubscriptionRepository from '@modules/early-access/infrastructure/persistence/mongo/repositories/EarlyAccessSubscriptionRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class CreateEarlyAccessSubscriptionUseCase implements IUseCase<
    CreateEarlyAccessSubscriptionInputDTO,
    CreateEarlyAccessSubscriptionOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly teamRepository: TeamRepository,
        private readonly earlyAccessSubscriptionRepository: EarlyAccessSubscriptionRepository
    ) {}

    async execute(input: CreateEarlyAccessSubscriptionInputDTO): Promise<Result<CreateEarlyAccessSubscriptionOutputDTO, ApplicationError>> {
        const team = await this.teamRepository.findById(input.teamId, {
            select: ['name']
        });

        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const email = EarlyAccessSubscription.normalizeEmail(input.email);
        const referrer = input.referrer?.trim() || undefined;
        const result = await this.earlyAccessSubscriptionRepository.recordInterest({
            team: team.id,
            email,
            source: input.source ?? EarlyAccessSubscriptionSource.DiscoverTeam,
            referrer,
            lastSubmittedAt: new Date()
        });

        return Result.ok({
            email: result.subscription.props.email,
            teamId: team.id,
            teamName: team.props.name,
            alreadySubscribed: result.alreadySubscribed
        });
    }
}
