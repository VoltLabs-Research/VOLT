import { ListUserTeamsInputDTO, ListUserTeamsOutputDTO } from '@modules/team/application/dtos/team/ListUserTeamsDTO';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class ListUserTeamsUseCase implements IUseCase<ListUserTeamsInputDTO, ListUserTeamsOutputDTO[], ApplicationError>{
    constructor(
        
        private teamRepository: TeamRepository
    ){}
    
    async execute(input: ListUserTeamsInputDTO): Promise<Result<ListUserTeamsOutputDTO[], ApplicationError>>{
        const { userId } = input;
        const userTeams = await this.teamRepository.findUserTeams(userId);
        return Result.ok(userTeams);
    }
};
