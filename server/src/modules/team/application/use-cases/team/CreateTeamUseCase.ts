import { ITeamRepository } from '@modules/team/domain/port/ITeamRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { CreateTeamInputDTO, CreateTeamOutputDTO } from '@modules/team/application/dtos/team/CreateTeamDTO';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamCreatedEvent from '@modules/team/domain/events/TeamCreatedEvent';

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, CreateTeamOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamInputDTO): Promise<Result<CreateTeamOutputDTO, ApplicationError>> {
        const { name, description, userId } = input;
        const team = await this.teamRepository.create({
            name,
            description,
            owner: userId
        });

        await this.eventBus.publish(new TeamCreatedEvent({
            ownerId: userId,
            teamId: team._id
        }));

        return Result.ok({
            _id: team._id,
            ...team.props
        });
    }
}
