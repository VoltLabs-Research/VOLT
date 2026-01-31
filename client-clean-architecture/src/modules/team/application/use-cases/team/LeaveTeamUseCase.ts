import { inject, injectable } from 'tsyringe';
import type ITeamRepository from '../../../domain/ports/ITeamRepository';
import type { LeaveTeamInputDTO } from '../../dtos/team';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class LeaveTeamUseCase implements IUseCase<LeaveTeamInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async execute({ teamId }: LeaveTeamInputDTO): Promise<void>{
        await this.teamRepository.leave(teamId);
    }
};
