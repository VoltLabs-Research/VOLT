import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO } from '@modules/team/application/dtos/team-invitation/AcceptTeamInvitationDTO';
import { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class AcceptTeamInvitationUseCase implements IUseCase<AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

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

        await this.invitationRepository.updateById(invitation._id, invitation.accept());

        return Result.ok({
            message: 'Invitation accepted successfully'
        });
    }
};
