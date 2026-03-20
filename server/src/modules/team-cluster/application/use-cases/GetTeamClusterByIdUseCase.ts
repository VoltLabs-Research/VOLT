import {
    GetTeamClusterByIdInputDTO,
    GetTeamClusterByIdOutputDTO
} from '@modules/team-cluster/application/dtos/GetTeamClusterByIdDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetTeamClusterByIdUseCase implements IUseCase<GetTeamClusterByIdInputDTO, GetTeamClusterByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
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
};
