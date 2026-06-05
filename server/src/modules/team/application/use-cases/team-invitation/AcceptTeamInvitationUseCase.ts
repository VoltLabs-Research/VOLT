import type TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import type TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import { AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO } from '@modules/team/application/dtos/team-invitation/AcceptTeamInvitationDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class AcceptTeamInvitationUseCase implements IUseCase<AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly invitationRepository: TeamInvitationRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: TeamRoleRepository,
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository
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
