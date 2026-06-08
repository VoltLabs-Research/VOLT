import type { IClusterTransferJobRepository } from '@modules/cluster/domain/port/IClusterTransferJobRepository';
import { inject } from 'tsyringe';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import { toClusterTransferJobDTO } from '@modules/cluster/application/dtos/ClusterTransferJobDTO';
import {
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO
} from '@modules/cluster/application/dtos/ListTeamClusterTransferJobsDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import type { ClusterTransferJobProps } from '@modules/cluster/domain/entities/ClusterTransferJob';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

interface ClusterTransferJobFilter {
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
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.ClusterTransferJobRepository) private readonly clusterTransferJobRepository: IClusterTransferJobRepository
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
