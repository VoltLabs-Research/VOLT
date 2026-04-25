import { GenerateTeamInviteCodeInputDTO, GenerateTeamInviteCodeOutputDTO } from '@modules/team/application/dtos/team/GenerateTeamInviteCodeDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { getInviteCodePermissionError } from '@modules/team/application/use-cases/team/invite-code-helpers';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

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
export default class GenerateTeamInviteCodeUseCase implements IUseCase<GenerateTeamInviteCodeInputDTO, GenerateTeamInviteCodeOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamRepository: TeamRepository,

        
        private readonly teamMemberRepository: TeamMemberRepository
    ) {}

    async execute(input: GenerateTeamInviteCodeInputDTO): Promise<Result<GenerateTeamInviteCodeOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;

        const permissionError = await getInviteCodePermissionError(this.teamMemberRepository, teamId, userId);
        if (permissionError) {
            return Result.fail(permissionError);
        }

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        let code = generateCode();
        let existing = await this.teamRepository.findByInviteCode(code);
        while (existing) {
            code = generateCode();
            existing = await this.teamRepository.findByInviteCode(code);
        }

        const updated = await this.teamRepository.updateById(teamId, { inviteCode: code });
        if (!updated) {
            return Result.fail(ApplicationError.internalServerError('Failed to update team'));
        }

        return Result.ok(toPersistedOutput(updated));
    }
};
