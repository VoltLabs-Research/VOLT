import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/ITeamInvitationRepository';
import type {
    GetTeamInvitationByIdInputDTO,
    GetTeamInvitationByIdOutputDTO
} from '@modules/team/application/dtos/team-invitation/GetTeamInvitationByIdDTO';

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
}
