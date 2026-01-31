import { inject, injectable } from 'tsyringe';
import type ITeamRepository from '../../../domain/ports/ITeamRepository';
import type { UpdateTeamInputDTO } from '../../dtos/team';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { Team } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class UpdateTeamUseCase implements IUseCase<UpdateTeamInputDTO, Team>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async execute(data: UpdateTeamInputDTO): Promise<Team>{
        return this.teamRepository.update(data.teamId, data);
    }
};
