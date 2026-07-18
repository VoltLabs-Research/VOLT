import type { IClusterTransferJobRepository } from '@modules/cluster/ports/IClusterTransferJobRepository';
import { inject } from 'tsyringe';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import type { ClusterTransferJobDTO } from '@modules/cluster/dtos/ClusterTransferJobDTO';
import { toClusterTransferJobDTO } from '@modules/cluster/dtos/ClusterTransferJobDTO';
import {
    ListTeamClustersInputDTO,
    ListTeamClustersOutputDTO
} from '@modules/cluster/dtos/ListTeamClustersDTO';
import { toTeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable } from 'tsyringe';

interface ListTeamClustersFilter extends Record<string, unknown> {
    team: string;
}

@injectable()
export default class ListTeamClustersByTeamIdUseCase implements IUseCase<ListTeamClustersInputDTO, ListTeamClustersOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.ClusterTransferJobRepository) private readonly clusterTransferJobRepository: IClusterTransferJobRepository
    ){}

    async execute(input: ListTeamClustersInputDTO): Promise<ListTeamClustersOutputDTO> {
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

        return {
            ...result,
            data: result.data.map((teamCluster) => toTeamClusterDTO(teamCluster, {
                activeTransfers: activeTransfersByClusterId.get(teamCluster.id) ?? []
            }))
        };
    }
}
