import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { GetTeamInvitationByIdInputDTO, GetTeamInvitationByIdOutputDTO } from '@modules/team/application/dtos/team-invitation/GetTeamInvitationByIdDTO';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';

@injectable()
export default class GetTeamInvitationByIdUseCase implements IUseCase<GetTeamInvitationByIdInputDTO, GetTeamInvitationByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly repository: ITeamInvitationRepository
    ) {}

    async execute(input: GetTeamInvitationByIdInputDTO): Promise<Result<GetTeamInvitationByIdOutputDTO, ApplicationError>> {
        const entity = await this.repository.findById(input.invitationId, {
            populate: {
                path: 'invitedBy team',
                select: ['firstName', 'lastName', 'name', '_id']
            }
        });
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'TeamInvitation not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
};
