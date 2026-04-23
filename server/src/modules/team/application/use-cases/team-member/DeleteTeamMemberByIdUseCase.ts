import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import TeamMemberDeletedEvent from '@modules/team/domain/events/team-member/TeamMemberDeletedEvent';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamMemberByIdUseCase implements IUseCase<TeamScopedEntityIdInputDTO<'teamMemberId'>, null, ApplicationError>{
    constructor(
        
        private teamMemberRepository: TeamMemberRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: TeamScopedEntityIdInputDTO<'teamMemberId'>): Promise<Result<null, ApplicationError>>{
        const { teamMemberId, teamId } = input;
        const teamMember = await this.teamMemberRepository.deleteById(teamMemberId);
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        await this.eventBus.publish(new TeamMemberDeletedEvent({
            teamMemberId,
            teamId
        }));

        return Result.ok(null);
    }
};
