import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import type { ITeamMembershipService } from '@modules/team/domain/port/team/ITeamMembershipService';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import { JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO } from '@modules/team/application/dtos/team/JoinTeamByInviteCodeDTO';
import { invalidInviteCodeError, normalizeInviteCode } from '@modules/team/application/use-cases/team/invite-code-helpers';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class JoinTeamByInviteCodeUseCase implements IUseCase<JoinTeamByInviteCodeInputDTO, JoinTeamByInviteCodeOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamMembershipService) private readonly membershipService: ITeamMembershipService
    ) {}

    async execute(input: JoinTeamByInviteCodeInputDTO): Promise<JoinTeamByInviteCodeOutputDTO> {
        const { userId, code } = input;

        const team = await this.teamRepository.findByInviteCode(normalizeInviteCode(code));
        if (!team) {
            throw invalidInviteCodeError();
        }

        const existing = await this.teamMemberRepository.findOne({
            team: team._id,
            user: userId
        });

        if (existing) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITE_CODE_ALREADY_MEMBER,
                'You are already a member of this team'
            );
        }

        try {
            await this.membershipService.addMemberToTeam(userId, team._id, SystemRoleNames.OWNER);
        } catch (err) {
            if (err instanceof ApplicationError) throw err;
            throw err;
        }

        return {
            message: 'Successfully joined team',
            teamId: team._id
        };
    }
}
