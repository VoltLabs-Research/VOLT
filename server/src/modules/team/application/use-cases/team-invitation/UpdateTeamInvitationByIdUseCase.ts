import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

interface UpdateTeamInvitationByIdInput {
    invitationId: string;
    data: Partial<TeamInvitationProps>;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

@injectable()
export default class UpdateTeamInvitationByIdUseCase implements IUseCase<UpdateTeamInvitationByIdInput, PersistedOutput<TeamInvitationProps>, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly repository: ITeamInvitationRepository
    ) {}

    async execute(input: UpdateTeamInvitationByIdInput): Promise<Result<PersistedOutput<TeamInvitationProps>, ApplicationError>> {
        const entity = await this.repository.updateById(input.invitationId, input.data, input.options);
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'TeamInvitation not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
};
