import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { inject } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import {
    GetTeamClusterByIdInputDTO,
    GetTeamClusterByIdOutputDTO
} from '@modules/cluster/application/dtos/GetTeamClusterByIdDTO';
import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetTeamClusterByIdUseCase implements IUseCase<GetTeamClusterByIdInputDTO, GetTeamClusterByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async execute(input: GetTeamClusterByIdInputDTO): Promise<Result<GetTeamClusterByIdOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        return Result.ok({
            teamCluster: toTeamClusterDTO(teamCluster)
        });
    }
}
