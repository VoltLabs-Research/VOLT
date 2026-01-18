import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { IUserRepository } from '@modules/auth/domain/ports/IUserRepository';
import { SendTeamInvitationInputDTO, SendTeamInvitationOutputDTO } from '@modules/team/application/dtos/team-invitation/SendTeamInvitationDTO';
import crypto from 'crypto';
import { TeamInvitationStatus } from '@modules/team/domain/entities/TeamInvitation';
import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';

@injectable()
export default class SendTeamInvitationUseCase implements IUseCase<SendTeamInvitationInputDTO, SendTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(input: SendTeamInvitationInputDTO): Promise<Result<SendTeamInvitationOutputDTO, ApplicationError>> {
        const { teamId, invitedByUserId, email, roleId } = input;

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const user = await this.userRepository.findByEmail(email.toLowerCase());
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            ));
        }
        
        if (user && team.props.members.includes(user.id)) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER,
                'User is already a member of this team'
            ));
        }

        const existingInvitation = await this.invitationRepository.findOne({
            team: teamId,
            email: email.toLowerCase(),
            status: TeamInvitationStatus.Pending
        });

        if (existingInvitation) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_SENT,
                'Invitation already sent to this email'
            ));
        }

        const role = await this.teamRoleRepository.findById(roleId);
        if(!role){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await this.invitationRepository.create({
            team: teamId,
            invitedBy: invitedByUserId,
            invitedUser: user.id,
            email: email.toLowerCase(),
            token,
            role: role.id,
            expiresAt,
            acceptedAt: new Date(),
            status: TeamInvitationStatus.Pending
        });

        return Result.ok(invitation.props);
    }
}
