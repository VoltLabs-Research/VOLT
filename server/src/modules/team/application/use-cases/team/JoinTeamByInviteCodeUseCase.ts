import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO } from '@modules/team/application/dtos/team/JoinTeamByInviteCodeDTO';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class JoinTeamByInviteCodeUseCase implements IUseCase<JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ) {}

    async execute(input: JoinTeamByInviteCodeInputDTO): Promise<Result<JoinTeamByInviteCodeOutputDTO, ApplicationError>> {
        const { userId, code } = input;

        const normalizedCode = code.trim().toUpperCase();

        const team = await this.teamRepository.findByInviteCode(normalizedCode);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITE_CODE_NOT_FOUND,
                'Invalid invite code'
            ));
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

        const role = await this.teamRoleRepository.findOne({ name: 'Member', team: team._id });
        if (!role) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Default member role not found'
            ));
        }

        const teamMember = await this.teamMemberRepository.create({
            team: team._id,
            user: userId,
            role: role._id,
            joinedAt: new Date()
        });

        await this.teamRepository.addMemberToTeam(teamMember._id, team._id);

        return Result.ok({ message: 'Successfully joined team' });
    }
};
