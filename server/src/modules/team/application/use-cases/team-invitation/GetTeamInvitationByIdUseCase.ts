import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import { GetTeamInvitationByIdInputDTO, GetTeamInvitationByIdOutputDTO } from '@modules/team/application/dtos/team-invitation/GetTeamInvitationByIdDTO';

@injectable()
export default class GetTeamInvitationByIdUseCase implements IUseCase<GetTeamInvitationByIdInputDTO, GetTeamInvitationByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private invitationRepository: ITeamInvitationRepository
    ){}

    async execute(input: GetTeamInvitationByIdInputDTO): Promise<Result<GetTeamInvitationByIdOutputDTO, ApplicationError>> {
        const { invitationId } = input;
        const invitation = await this.invitationRepository.findById(invitationId, {
            populate: {
                path: 'invitedBy team',
                select: 'firstName lastName name _id'
            }
        });
        if (!invitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Team invitation not found'
            ));
        }

        return Result.ok(invitation.props);
    }
};