import { toClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';
import {
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO
} from '@modules/team-cluster/application/dtos/ListTeamClusterTransferJobsDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { ClusterTransferJobProps } from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';

interface ClusterTransferJobFilter extends Record<string, unknown> {
    team: string;
    $or: Array<Pick<ClusterTransferJobProps, 'sourceClusterId'> | Pick<ClusterTransferJobProps, 'destinationClusterId'>>;
    state?: ClusterTransferJobProps['state'];
}

@injectable()
export default class ListTeamClusterTransferJobsUseCase implements IUseCase<
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferJobRepository)
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository
    ) {}

    async execute(
        input: ListTeamClusterTransferJobsInputDTO
    ): Promise<Result<ListTeamClusterTransferJobsOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const filter: ClusterTransferJobFilter = {
            team: input.teamId,
            $or: [
                {
                    sourceClusterId: teamCluster.id
                },
                {
                    destinationClusterId: teamCluster.id
                }
            ]
        };

        if (input.state) {
            filter.state = input.state;
        }

        const result = await this.clusterTransferJobRepository.findAll({
            filter,
            page: input.page,
            limit: input.limit,
            sort: {
                createdAt: -1,
                updatedAt: -1
            }
        });

        return Result.ok({
            ...result,
            data: result.data.map(toClusterTransferJobDTO)
        });
    }
}
