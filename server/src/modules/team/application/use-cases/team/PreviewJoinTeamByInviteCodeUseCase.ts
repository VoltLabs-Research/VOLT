import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import {
    PreviewJoinTeamByInviteCodeInputDTO,
    PreviewJoinTeamByInviteCodeOutputDTO
} from '@modules/team/application/dtos/team/PreviewJoinTeamByInviteCodeDTO';
import { invalidInviteCodeError, normalizeInviteCode } from '@modules/team/application/use-cases/team/invite-code-helpers';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface PopulatedTeamOwner {
    props: {
        firstName?: string;
        lastName?: string;
    };
}

@injectable()
export default class PreviewJoinTeamByInviteCodeUseCase implements IUseCase<PreviewJoinTeamByInviteCodeInputDTO, PreviewJoinTeamByInviteCodeOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: PreviewJoinTeamByInviteCodeInputDTO): Promise<Result<PreviewJoinTeamByInviteCodeOutputDTO, ApplicationError>> {
        const team = await this.teamRepository.findByInviteCode(normalizeInviteCode(input.code));

        if (!team) {
            return Result.fail(invalidInviteCodeError());
        }

        const existingMember = await this.teamMemberRepository.findOne({
            team: team._id,
            user: input.userId
        });
        const owner = team.props.owner as string | PopulatedTeamOwner;
        const ownerDetails = typeof owner === 'string' ? null : owner.props;
        const ownerFirstName = ownerDetails?.firstName?.trim() ?? '';
        const ownerLastName = ownerDetails?.lastName?.trim() ?? '';
        const ownerName = `${ownerFirstName} ${ownerLastName}`.trim() || 'Team owner';

        return Result.ok({
            message: 'Invite preview loaded',
            teamId: team._id,
            teamName: team.props.name,
            ownerName,
            isAlreadyMember: Boolean(existingMember)
        });
    }
}
