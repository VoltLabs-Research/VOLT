import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { AUTH_TOKENS } from '@/src/modules/auth/infrastructure/di/AuthTokens';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { IUserRepository } from '@/src/modules/auth/domain/ports/IUserRepository';
import { SendTeamInvitationInputDTO, SendTeamInvitationOutputDTO } from '../../dtos/team-invitation/SendTeamInvitationDTO';
import crypto from 'crypto';
import { TeamInvitationStatus } from '../../../domain/entities/TeamInvitation';

@injectable()
export default class SendTeamInvitationUseCase implements IUseCase<SendTeamInvitationInputDTO, SendTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ) { }

    async execute(input: SendTeamInvitationInputDTO): Promise<Result<SendTeamInvitationOutputDTO, ApplicationError>> {
        const { teamId, invitedByUserId, email, role } = input;

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const user = await this.userRepository.findByEmail(email.toLowerCase());
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

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await this.invitationRepository.create({
            team: teamId,
            invitedBy: invitedByUserId,
            invitedUser: user?.id || '',
            email: email.toLowerCase(),
            token,
            role: role as any,
            expiresAt,
            acceptedAt: new Date(),
            status: TeamInvitationStatus.Pending
        });

        return Result.ok(invitation.props);
    }
}
