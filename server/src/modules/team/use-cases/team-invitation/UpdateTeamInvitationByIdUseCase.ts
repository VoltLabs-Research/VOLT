import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamInvitationProps } from '@modules/team/entities/team-invitation/TeamInvitation';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { inject, injectable } from 'tsyringe';

interface UpdateTeamInvitationByIdInput {
    invitationId: string;
    data: Partial<TeamInvitationProps>;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
}

@injectable()
export default class UpdateTeamInvitationByIdUseCase implements IUseCase<UpdateTeamInvitationByIdInput, PersistedOutput<TeamInvitationProps>> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly repository: ITeamInvitationRepository
    ) {}

    async execute(input: UpdateTeamInvitationByIdInput): Promise<PersistedOutput<TeamInvitationProps>> {
        const entity = await this.repository.updateById(input.invitationId, input.data, input.options);
        if (!entity) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'TeamInvitation not found'
            );
        }
        return toPersistedOutput(entity);
    }
}
