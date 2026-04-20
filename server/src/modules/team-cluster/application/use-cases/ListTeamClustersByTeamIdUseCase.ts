import {
    ListTeamClustersInputDTO,
    ListTeamClustersOutputDTO
} from '@modules/team-cluster/application/dtos/ListTeamClustersDTO';
import { toClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import type { ClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';

interface ListTeamClustersFilter extends Record<string, unknown> {
    team: string;
};

@injectable()
export default class ListTeamClustersByTeamIdUseCase implements IUseCase<ListTeamClustersInputDTO, ListTeamClustersOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferJobRepository)
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository
    ){}

    async execute(input: ListTeamClustersInputDTO): Promise<Result<ListTeamClustersOutputDTO, ApplicationError>> {
        const filter: ListTeamClustersFilter = {
            team: input.teamId
        };

        const search = input.search?.trim();
        if (search) {
            filter.$or = [
                {
                    name: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    installedVersion: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    $expr: {
                        $regexMatch: {
                            input: {
                                $toString: '$_id'
                            },
                            regex: search,
                            options: 'i'
                        }
                    }
                }
            ];
        }

        const result = await this.teamClusterRepository.findAll({
            filter,
            page: input.page,
            limit: input.limit,
            sort: {
                createdAt: -1
            }
        });

        const clusterIds = result.data.map((teamCluster) => teamCluster.id);
        const clusterIdSet = new Set(clusterIds);
        const activeTransfersByClusterId = new Map<string, ClusterTransferJobDTO[]>();

        const activeTransferJobs = await this.clusterTransferJobRepository.listOpenByClusterIds(input.teamId, clusterIds);

        for (const job of activeTransferJobs) {
            const jobDTO = toClusterTransferJobDTO(job);

            if (clusterIdSet.has(job.props.sourceClusterId)) {
                const sourceJobs = activeTransfersByClusterId.get(job.props.sourceClusterId) ?? [];
                sourceJobs.push(jobDTO);
                activeTransfersByClusterId.set(job.props.sourceClusterId, sourceJobs);
            }

            if (job.props.destinationClusterId !== job.props.sourceClusterId && clusterIdSet.has(job.props.destinationClusterId)) {
                const destinationJobs = activeTransfersByClusterId.get(job.props.destinationClusterId) ?? [];
                destinationJobs.push(jobDTO);
                activeTransfersByClusterId.set(job.props.destinationClusterId, destinationJobs);
            }
        }

        return Result.ok({
            ...result,
            data: result.data.map((teamCluster) => toTeamClusterDTO(teamCluster, {
                activeTransfers: activeTransfersByClusterId.get(teamCluster.id) ?? []
            }))
        });
    }
};
