import { toClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';
import {
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO
} from '@modules/team-cluster/application/dtos/ListTeamClusterTransferJobsDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import type { ClusterTransferJobProps } from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

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
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
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
