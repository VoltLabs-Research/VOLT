import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import {
    PreviewJoinTeamByInviteCodeInputDTO,
    PreviewJoinTeamByInviteCodeOutputDTO
} from '@modules/team/dtos/team/PreviewJoinTeamByInviteCodeDTO';
import { invalidInviteCodeError, normalizeInviteCode } from '@modules/team/use-cases/team/invite-code-helpers';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

interface PopulatedTeamOwner {
    props: {
        firstName?: string;
        lastName?: string;
    };
}

@injectable()
export default class PreviewJoinTeamByInviteCodeUseCase implements IUseCase<PreviewJoinTeamByInviteCodeInputDTO, PreviewJoinTeamByInviteCodeOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: PreviewJoinTeamByInviteCodeInputDTO): Promise<PreviewJoinTeamByInviteCodeOutputDTO> {
        const team = await this.teamRepository.findByInviteCode(normalizeInviteCode(input.code));

        if (!team) {
            throw invalidInviteCodeError();
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

        return {
            message: 'Invite preview loaded',
            teamId: team._id,
            teamName: team.props.name,
            ownerName,
            isAlreadyMember: Boolean(existingMember)
        };
    }
}
