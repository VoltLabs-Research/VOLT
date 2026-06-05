import type TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import { JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO } from '@modules/team/application/dtos/team/JoinTeamByInviteCodeDTO';
import { invalidInviteCodeError, normalizeInviteCode } from '@modules/team/application/use-cases/team/invite-code-helpers';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class JoinTeamByInviteCodeUseCase implements IUseCase<JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: TeamRoleRepository,
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository
    ) {}

    async execute(input: JoinTeamByInviteCodeInputDTO): Promise<Result<JoinTeamByInviteCodeOutputDTO, ApplicationError>> {
        const { userId, code } = input;

        const team = await this.teamRepository.findByInviteCode(normalizeInviteCode(code));
        if (!team) {
            return Result.fail(invalidInviteCodeError());
        }

        const existing = await this.teamMemberRepository.findOne({
            team: team._id,
            user: userId
        });

        if (existing) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITE_CODE_ALREADY_MEMBER,
                'You are already a member of this team'
            ));
        }

        const role = await this.teamRoleRepository.findOne({ name: SystemRoleNames.OWNER, team: team._id });
        if (!role) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Owner role not found'
            ));
        }

        const teamMember = await this.teamMemberRepository.create({
            team: team._id,
            user: userId,
            role: role._id,
            joinedAt: new Date()
        });

        await this.teamRepository.addMemberToTeam(teamMember._id, team._id);
        await this.userRepository.addTeamToUser(userId, team._id);

        return Result.ok({
            message: 'Successfully joined team',
            teamId: team._id
        });
    }
}
