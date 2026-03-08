import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ITeamInvitationRepository } from '@modules/team/domain/port/ITeamInvitationRepository';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { ITeamRepository } from '@modules/team/domain/port/ITeamRepository';
import { AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO } from '@modules/team/application/dtos/team-invitation/AcceptTeamInvitationDTO';
import { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class AcceptTeamInvitationUseCase implements IUseCase<AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: AcceptTeamInvitationInputDTO): Promise<Result<AcceptTeamInvitationOutputDTO, ApplicationError>> {
        const { invitationId, userId } = input;

        const invitation = await this.invitationRepository.findById(invitationId);
        if (!invitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found'
            ));
        }

        if (!invitation.isPending()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED,
                'Invitation has already been processed'
            ));
        }

        if (invitation.isExpired()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_EXPIRED,
                'Invitation has expired'
            ));
        }

        if (invitation.getInvitedUserId() !== userId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_INVITATION_INVALID_USER,
                'This invitation was not sent to you'
            ));
        }

        const teamId = invitation.getTeamId();
        const roleId = invitation.getRoleId();

        const teamMember = await this.teamMemberRepository.create({
            team: teamId,
            user: userId,
            role: roleId,
            joinedAt: new Date()
        });

        await this.teamRepository.addMemberToTeam(teamMember._id, teamId);

        await this.invitationRepository.updateById(invitation._id, invitation.accept());

        return Result.ok({
            message: 'Invitation accepted successfully'
        });
    }
}
