import { toClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';
import {
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO
} from '@modules/team-cluster/application/dtos/CreateTeamClusterTransferRequestDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ClusterTransferRunner from '@modules/team-cluster/infrastructure/services/ClusterTransferRunner';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type ClusterTransferCoordinator from '@modules/team-cluster/application/services/ClusterTransferCoordinator';
import type ClusterTransferJob from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import type StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

@injectable()
export default class CreateTeamClusterTransferRequestUseCase implements IUseCase<
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferCoordinator)
        private readonly clusterTransferCoordinator: ClusterTransferCoordinator,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferRunner)
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
