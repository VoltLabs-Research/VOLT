import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamMembershipService } from '@modules/team/domain/port/team/ITeamMembershipService';
import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import TeamMemberDeletedEvent from '@modules/team/domain/events/team-member/TeamMemberDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamMemberByIdUseCase implements IUseCase<TeamScopedEntityIdInputDTO<'teamMemberId'>, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamMembershipService) private readonly teamMembershipService: ITeamMembershipService,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: TeamScopedEntityIdInputDTO<'teamMemberId'>): Promise<Result<null, ApplicationError>>{
        const { teamMemberId, teamId } = input;
        const teamMember = await this.teamMemberRepository.findById(teamMemberId);
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        await this.teamMembershipService.removeMemberFromTeam(teamMemberId, teamId);

        await this.eventBus.publish(new TeamMemberDeletedEvent({
            teamMemberId,
            teamId
        }));

        return Result.ok(null);
    }
}
