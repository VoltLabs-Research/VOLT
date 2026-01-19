import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { TeamInvitationStatus } from '@modules/team/domain/entities/TeamInvitation';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';

export interface AcceptTeamInvitationInputDTO {
    invitationId: string;
    userId: string;
}

export interface AcceptTeamInvitationOutputDTO {
    message: string;
}

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
    ) { }

    async execute(input: AcceptTeamInvitationInputDTO): Promise<Result<AcceptTeamInvitationOutputDTO, ApplicationError>> {
        const { invitationId, userId } = input;

        const invitation = await this.invitationRepository.findById(invitationId);
        if (!invitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found'
            ));
        }

        if (invitation.props.status !== TeamInvitationStatus.Pending) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED,
                'Invitation has already been processed'
            ));
        }

        if (invitation.props.expiresAt < new Date()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_EXPIRED,
                'Invitation has expired'
            ));
        }

        // Verify the user accepting is the one invited (if user check is enforced by login, this ensures it matches)
        // Adjust logic if invitedUser is populated object vs ID. Assuming ID based on mapper but let's be safe.
        // The mapper populates it, so it might be an object. We'll check the ID.
        const invitedUserId = typeof invitation.props.invitedUser === 'object'
            ? (invitation.props.invitedUser as any).id || (invitation.props.invitedUser as any)._id
            : invitation.props.invitedUser;

        if (invitedUserId.toString() !== userId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_INVITATION_INVALID_USER,
                'This invitation was not sent to you'
            ));
        }

        // Create Team Member
        const teamMember = await this.teamMemberRepository.create({
            team: invitation.props.team as any, // ID or object, repository handles it usually but let's assume partial props
            user: userId,
            role: invitation.props.role as any,
            joinedAt: new Date()
        });

        // Add member to team (Repository method update)
        // We need to update the team's member list. 
        // Best approach: TeamRepository.addMemberToTeam(memberId, teamId)
        // Assuming invitation.props.team is the Team ID or populated Team
        const teamId = typeof invitation.props.team === 'object'
            ? (invitation.props.team as any).id
            : invitation.props.team;

        await this.teamRepository.addMemberToTeam(teamMember.id, teamId);

        // Update Invitation Status
        invitation.props.status = TeamInvitationStatus.Accepted;
        invitation.props.acceptedAt = new Date();
        await this.invitationRepository.updateById(invitation.id, invitation.props);

        // TODO: Publish TeamMemberAddedEvent if needed
        // await this.eventBus.publish(new TeamMemberAddedEvent(...));

        return Result.ok({ message: 'Invitation accepted successfully' });
    }
}
