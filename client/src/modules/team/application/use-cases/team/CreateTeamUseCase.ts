import { inject, injectable } from 'tsyringe';
import type ITeamRepository from '../../../domain/ports/ITeamRepository';
import type ITeamStorage from '../../../domain/ports/ITeamStorage';
import type { CreateTeamInputDTO } from '../../dtos/team';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { Team } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class CreateTeamUseCase implements IUseCase<CreateTeamInputDTO, Team>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamStorage)
        private readonly teamStorage: ITeamStorage
    ){}

    async execute(data: CreateTeamInputDTO): Promise<Team>{
        const team = await this.teamRepository.create(data);
        this.teamStorage.setSelectedTeamId(team._id);
        return team;
    }
};
