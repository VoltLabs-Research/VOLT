import { inject, injectable } from 'tsyringe';
import type ITeamRoleRepository from '../../../domain/ports/ITeamRoleRepository';
import type { DeleteTeamRoleInputDTO } from '../../dtos/team-role';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class DeleteTeamRoleUseCase implements IUseCase<DeleteTeamRoleInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(data: DeleteTeamRoleInputDTO): Promise<void>{
        await this.teamRoleRepository.delete(data.teamId, data.roleId);
    }
};
