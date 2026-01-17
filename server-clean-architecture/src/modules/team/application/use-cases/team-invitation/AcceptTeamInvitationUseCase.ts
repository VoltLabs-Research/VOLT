import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { AUTH_TOKENS } from '@/src/modules/auth/infrastructure/di/AuthTokens';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { ITeamRoleRepository } from '../../../domain/ports/ITeamRoleRepository';
import { ITeamMemberRepository } from '../../../domain/ports/ITeamMemberRepository';
import { IUserRepository } from '@/src/modules/auth/domain/ports/IUserRepository';
import { AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO } from '../../dtos/team-invitation/AcceptTeamInvitationDTO';

@injectable()
export default class AcceptTeamInvitationUseCase implements IUseCase<AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly roleRepository: ITeamRoleRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly memberRepository: ITeamMemberRepository,
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ) {}

    async execute(input: AcceptTeamInvitationInputDTO): Promise<Result<AcceptTeamInvitationOutputDTO, ApplicationError>> {
        const { invitationId, userId, userEmail } = input;

        const invitation = await this.invitationRepository.findById(invitationId);
        if (!invitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found'
            ));
        }

        if (invitation.isExpired()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_EXPIRED,
                'Invitation has expired'
            ));
        }

        const team = await this.teamRepository.findById(invitation.props.team);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        if (team.props.members.includes(userId)) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER,
                'User is already a member of this team'
            ));
        }

        let roleToAssign = null;
        if (invitation.props.role) {
            roleToAssign = await this.roleRepository.findOne({
                team: invitation.props.team,
                name: invitation.props.role
            });
        }

        if (!roleToAssign) {
            roleToAssign = await this.roleRepository.findOne({
                team: invitation.props.team,
                name: 'Member',
                isSystem: true
            });
        }

        if (!roleToAssign) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'No suitable role found for team member'
            ));
        }

        const existingMember = await this.memberRepository.findOne({
            team: invitation.props.team,
            user: userId
        });

        if (!existingMember) {
            await this.memberRepository.create({
                team: invitation.props.team,
                user: userId,
                role: roleToAssign.id,
                joinedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await Promise.all([
            this.teamRepository.updateById(invitation.props.team, {
                members: [...team.props.members, userId]
            }),
            this.userRepository.findById(userId).then(user => {
                if (user) {
                    const teams = (user.props as any).teams || [];
                    return this.userRepository.updateById(userId, {
                        teams: [...teams, invitation.props.team]
                    } as any);
                }
            }),
            this.invitationRepository.updateById(invitationId, {
                status: 'accepted' as any,
                acceptedAt: new Date()
            })
        ]);

        const updatedTeam = await this.teamRepository.findById(invitation.props.team);
        if (!updatedTeam) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Failed to retrieve updated team'
            ));
        }

        return Result.ok(updatedTeam.props);
    }
}
