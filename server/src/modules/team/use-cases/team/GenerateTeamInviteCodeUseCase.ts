import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { GenerateTeamInviteCodeInputDTO, GenerateTeamInviteCodeOutputDTO } from '@modules/team/dtos/team/GenerateTeamInviteCodeDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { getInviteCodePermissionError } from '@modules/team/use-cases/team/invite-code-helpers';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { inject, injectable } from 'tsyringe';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITE_CODE_LENGTH = 5;

const generateCode = (): string => {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
    }

    return code;
};

@injectable()
export default class GenerateTeamInviteCodeUseCase implements IUseCase<GenerateTeamInviteCodeInputDTO, GenerateTeamInviteCodeOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: GenerateTeamInviteCodeInputDTO): Promise<GenerateTeamInviteCodeOutputDTO> {
        const { teamId, userId } = input;

        const permissionError = await getInviteCodePermissionError(this.teamMemberRepository, teamId, userId);
        if (permissionError) {
            throw permissionError;
        }

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
        }

        let code = generateCode();
        let existing = await this.teamRepository.findByInviteCode(code);
        while (existing) {
            code = generateCode();
            existing = await this.teamRepository.findByInviteCode(code);
        }

        const updated = await this.teamRepository.updateById(teamId, { inviteCode: code });
        if (!updated) {
            throw ApplicationError.internalServerError('Failed to update team');
        }

        return toPersistedOutput(updated);
    }
}
