import type {
    CreateEarlyAccessSubscriptionInputDTO,
    CreateEarlyAccessSubscriptionOutputDTO
} from '@modules/early-access/dtos/CreateEarlyAccessSubscriptionDTO';
import EarlyAccessSubscription, {
    EarlyAccessSubscriptionSource
} from '@modules/early-access/entities/EarlyAccessSubscription';
import type { IEarlyAccessSubscriptionRepository } from '@modules/early-access/ports/IEarlyAccessSubscriptionRepository';
import { EARLY_ACCESS_TOKENS } from '@modules/early-access/di/EarlyAccessTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the early-access module. Folds the exact
 * logic of the former CreateEarlyAccessSubscriptionUseCase, converting the
 * Result error channel to thrown `ApplicationError`s so Express 5 forwards them
 * to the global error middleware.
 */
@Singleton(EARLY_ACCESS_TOKENS.EarlyAccessService)
export default class EarlyAccessService {
    constructor(
        @inject(TEAM_CONTRACT_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(EARLY_ACCESS_TOKENS.EarlyAccessSubscriptionRepository) private readonly earlyAccessSubscriptionRepository: IEarlyAccessSubscriptionRepository
    ) {}

    async createSubscription(input: CreateEarlyAccessSubscriptionInputDTO): Promise<CreateEarlyAccessSubscriptionOutputDTO> {
        const team = await this.teamRepository.findById(input.teamId, {
            select: ['name']
        });

        if (!team) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
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

        return {
            email: result.subscription.props.email,
            teamId: team.id,
            teamName: team.props.name,
            alreadySubscribed: result.alreadySubscribed
        };
    }
}
