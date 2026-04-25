import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import { JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO } from '@modules/team/application/dtos/team/JoinTeamByInviteCodeDTO';
import { invalidInviteCodeError, normalizeInviteCode } from '@modules/team/application/use-cases/team/invite-code-helpers';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class JoinTeamByInviteCodeUseCase implements IUseCase<JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamRepository: TeamRepository,

        
        private readonly teamMemberRepository: TeamMemberRepository,

        
        private readonly teamRoleRepository: TeamRoleRepository
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

        return Result.ok({
            message: 'Successfully joined team',
            teamId: team._id
        });
    }
};
