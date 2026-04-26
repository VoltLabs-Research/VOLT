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
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import ClusterTransferRunner from '@modules/cluster/infrastructure/services/ClusterTransferRunner';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class CreateTeamClusterTransferRequestUseCase implements IUseCase<
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly storagePlacementService: StoragePlacementService,

        
        private readonly clusterTransferCoordinator: ClusterTransferCoordinator,

        
        private readonly clusterTransferRunner: ClusterTransferRunner
    ) {}

    async execute(
        input: CreateTeamClusterTransferRequestInputDTO
    ): Promise<Result<CreateTeamClusterTransferRequestOutputDTO, ApplicationError>> {
        const sourceCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (sourceCluster instanceof ApplicationError) {
            return Result.fail(sourceCluster);
        }

        const destinationCluster = await requireOwnedTeamCluster(this.teamClusterRepository, {
            teamId: input.teamId,
            teamClusterId: input.destinationClusterId
        });
        if (destinationCluster instanceof ApplicationError) {
            return Result.fail(destinationCluster);
        }

        if (sourceCluster.id === destinationCluster.id) {
            return Result.fail(ApplicationError.conflict(
                'ClusterTransfer::DestinationMustDiffer',
                'Destination cluster must be different from the source cluster'
            ));
        }

        if (sourceCluster.props.status !== TeamClusterStatus.Connected || !sourceCluster.effectiveCapabilities.servesStorageReads) {
            return Result.fail(ApplicationError.conflict(
                'ClusterTransfer::SourceClusterUnavailable',
                'Source cluster must be connected and able to serve authoritative storage reads'
            ));
        }

        if (
            destinationCluster.props.status !== TeamClusterStatus.Connected
            || !destinationCluster.effectiveCapabilities.acceptsStorageWrites
        ) {
            return Result.fail(ApplicationError.conflict(
                'ClusterTransfer::DestinationClusterUnavailable',
                'Destination cluster must be connected and able to accept storage writes'
            ));
        }

        const placements = await this.storagePlacementService.resolveTransferPlacementsForCluster(input.teamId, sourceCluster.id);
        if (!placements.length) {
            return Result.fail(ApplicationError.conflict(
                'ClusterTransfer::NoPlacements',
                'This cluster has no authoritative storage placements to transfer'
            ));
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

        return Result.ok({
            message: requestedJobs.length === 1
                ? 'Queued 1 transfer job for this cluster.'
                : `Queued ${requestedJobs.length} transfer jobs for this cluster.`,
            sourceClusterId: sourceCluster.id,
            destinationClusterId: destinationCluster.id,
            requestedJobs: requestedJobs.map(toClusterTransferJobDTO)
        });
    }
}
