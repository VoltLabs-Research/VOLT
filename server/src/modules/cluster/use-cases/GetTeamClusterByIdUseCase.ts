import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import { inject } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import {
    GetTeamClusterByIdInputDTO,
    GetTeamClusterByIdOutputDTO
} from '@modules/cluster/dtos/GetTeamClusterByIdDTO';
import { toTeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/utilities/team-cluster-ownership';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable } from 'tsyringe';

@injectable()
export default class GetTeamClusterByIdUseCase implements IUseCase<GetTeamClusterByIdInputDTO, GetTeamClusterByIdOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async execute(input: GetTeamClusterByIdInputDTO): Promise<GetTeamClusterByIdOutputDTO> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            throw teamCluster;
        }

        return {
            teamCluster: toTeamClusterDTO(teamCluster)
        };
    }
}
