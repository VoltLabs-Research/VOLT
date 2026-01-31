import { inject, injectable } from 'tsyringe';
import type ITeamRoleRepository from '../../../domain/ports/ITeamRoleRepository';
import type { GetAllTeamRolesInputDTO } from '../../dtos/team-role';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { TeamRole } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetAllTeamRolesUseCase implements IUseCase<GetAllTeamRolesInputDTO, TeamRole[]>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(data: GetAllTeamRolesInputDTO): Promise<TeamRole[]>{
        return this.teamRoleRepository.getAll(data.teamId);
    }
};
