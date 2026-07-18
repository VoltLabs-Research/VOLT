import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { IClusterTransferRunner } from '@modules/cluster/domain/port/IClusterTransferRunner';
import { toClusterTransferJobDTO } from '@modules/cluster/application/dtos/ClusterTransferJobDTO';
import {
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO
} from '@modules/cluster/application/dtos/CreateTeamClusterTransferRequestDTO';
import ClusterTransferCoordinator from '@modules/cluster/application/services/ClusterTransferCoordinator';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import type ClusterTransferJob from '@modules/cluster/domain/entities/ClusterTransferJob';
import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class CreateTeamClusterTransferRequestUseCase implements IUseCase<CreateTeamClusterTransferRequestInputDTO, CreateTeamClusterTransferRequestOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        private readonly storagePlacementService: StoragePlacementService,
        private readonly clusterTransferCoordinator: ClusterTransferCoordinator,
        @inject(CLUSTER_TOKENS.ClusterTransferRunner) private readonly clusterTransferRunner: IClusterTransferRunner
    ) {}

    async execute(
        input: CreateTeamClusterTransferRequestInputDTO
    ): Promise<CreateTeamClusterTransferRequestOutputDTO> {
        const sourceCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (sourceCluster instanceof ApplicationError) {
            throw sourceCluster;
        }

        const destinationCluster = await requireOwnedTeamCluster(this.teamClusterRepository, {
            teamId: input.teamId,
            teamClusterId: input.destinationClusterId
        });
        if (destinationCluster instanceof ApplicationError) {
            throw destinationCluster;
        }

        if (sourceCluster.id === destinationCluster.id) {
            throw ApplicationError.conflict(
                'ClusterTransfer::DestinationMustDiffer',
                'Destination cluster must be different from the source cluster'
            );
        }

        if (sourceCluster.props.status !== TeamClusterStatus.Connected || !sourceCluster.effectiveCapabilities.servesStorageReads) {
            throw ApplicationError.conflict(
                'ClusterTransfer::SourceClusterUnavailable',
                'Source cluster must be connected and able to serve authoritative storage reads'
            );
        }

        if (
            destinationCluster.props.status !== TeamClusterStatus.Connected
            || !destinationCluster.effectiveCapabilities.acceptsStorageWrites
        ) {
            throw ApplicationError.conflict(
                'ClusterTransfer::DestinationClusterUnavailable',
                'Destination cluster must be connected and able to accept storage writes'
            );
        }

        const placements = await this.storagePlacementService.resolveTransferPlacementsForCluster(input.teamId, sourceCluster.id);
        if (!placements.length) {
            throw ApplicationError.conflict(
                'ClusterTransfer::NoPlacements',
                'This cluster has no authoritative storage placements to transfer'
            );
        }

        const requestedJobs: ClusterTransferJob[] = [];
        for (const placement of placements) {
            requestedJobs.push(await this.clusterTransferCoordinator.requestTransfer({
                teamId: input.teamId,
                scopeType: placement.props.scopeType,
                scopeId: placement.props.scopeId,
                destinationClusterId: destinationCluster.id,
                requestedBy: input.authenticatedUserId
            }));
        }

        this.clusterTransferRunner.kick(Math.min(Math.max(requestedJobs.length, 1), 10));

        return {
            message: requestedJobs.length === 1
                ? 'Queued 1 transfer job for this cluster.'
                : `Queued ${requestedJobs.length} transfer jobs for this cluster.`,
            sourceClusterId: sourceCluster.id,
            destinationClusterId: destinationCluster.id,
            requestedJobs: requestedJobs.map(toClusterTransferJobDTO)
        };
    }
}
