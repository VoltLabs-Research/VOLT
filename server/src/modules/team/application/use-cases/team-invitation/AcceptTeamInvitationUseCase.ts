import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import { AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO } from '@modules/team/application/dtos/team-invitation/AcceptTeamInvitationDTO';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class AcceptTeamInvitationUseCase implements IUseCase<AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        private readonly invitationRepository: TeamInvitationRepository,
        private readonly teamMemberRepository: TeamMemberRepository,
        private readonly teamRepository: TeamRepository,
        private readonly teamRoleRepository: TeamRoleRepository,
        private readonly userRepository: UserRepository
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
        const ownerRole = await this.teamRoleRepository.findOne({ name: SystemRoleNames.OWNER, team: teamId });
        if (!ownerRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Owner role not found'
            ));
        }

        const teamMember = await this.teamMemberRepository.create({
            team: teamId,
            user: userId,
            role: ownerRole._id,
            joinedAt: new Date()
        });

        await this.teamRepository.addMemberToTeam(teamMember._id, teamId);
        await this.userRepository.addTeamToUser(userId, teamId);

        await this.invitationRepository.updateById(invitation._id, invitation.accept());

        return Result.ok({
            message: 'Invitation accepted successfully'
        });
    }
}
