import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { EntityIdInputDTO } from '@modules/team/application/dtos/common';
import { DeleteTeamMemberByIdInputDTO } from '@modules/team/application/dtos/team-member/DeleteTeamMemberByIdDTO';
import TeamMemberDeletedEvent from '@modules/team/domain/events/team-member/TeamMemberDeletedEvent';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

type DeleteTeamMemberCommand = EntityIdInputDTO<'teamMemberId'>;

@injectable()
export default class DeleteTeamMemberByIdUseCase implements IUseCase<DeleteTeamMemberByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamMemberByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { teamMemberId, teamId } = input;
        const teamMember = await this.deleteTeamMember({ teamMemberId });
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

    private async deleteTeamMember(input: DeleteTeamMemberCommand): Promise<boolean> {
        return this.teamMemberRepository.deleteById(input.teamMemberId);
    }
};
