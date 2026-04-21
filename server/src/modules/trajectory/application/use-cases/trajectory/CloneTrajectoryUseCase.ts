import { ErrorCodes } from '@core/constants/error-codes';
import { ClusterRoleAwareSelectionService } from '@modules/container/infrastructure/services/ClusterRoleAwareSelectionService';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import { resolveEffectiveCapabilitiesFromRoleConfig, TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TrajectoryCloneCoordinator from '@modules/trajectory/application/services/TrajectoryCloneCoordinator';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import {
    CloneTrajectoryInputDTO,
    CloneTrajectoryOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/CloneTrajectoryDTO';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { createTrajectoryCloneJobProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

import { inject, injectable } from 'tsyringe';
import type TrajectoryCloneJobRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryCloneJobRepository';
import type TrajectoryCloneRunner from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryCloneRunner';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ITrajectoryFrameRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryFrameRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export default class CloneTrajectoryUseCase implements IUseCase<
    CloneTrajectoryInputDTO,
    CloneTrajectoryOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryFrameRepository)
        private readonly trajectoryFrameRepository: ITrajectoryFrameRepository,

        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(TRAJECTORY_TOKENS.TrajectoryCloneJobRepository)
        private readonly cloneJobRepository: TrajectoryCloneJobRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryCloneCoordinator)
        private readonly cloneCoordinator: TrajectoryCloneCoordinator,

        @inject(TRAJECTORY_TOKENS.TrajectoryCloneRunner)
        private readonly cloneRunner: TrajectoryCloneRunner,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(ClusterRoleAwareSelectionService)
        private readonly clusterSelectionService: ClusterRoleAwareSelectionService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CloneTrajectoryInputDTO): Promise<Result<CloneTrajectoryOutputDTO, ApplicationError>> {
        try {
            const source = await this.trajectoryReadAccessService.assertReadable(
                input.sourceTrajectoryId,
                input.userId
            );

            const destinationClusterId = await this.resolveDestinationStorageClusterId(
                input.teamId,
                input.targetClusterId
            );

            const sourceClusterId = resolveTrajectoryStorageClusterId(source.props) ?? null;
            const sourceFrames = await this.trajectoryFrameRepository.getFrames(source.id);

            const now = new Date();

            const destinationTrajectory = await this.trajectoryRepository.create({
                name: source.props.name,
                team: input.teamId,
                folder: null,
                storageClusterId: destinationClusterId,
                createdBy: input.userId,
                status: TrajectoryStatus.Processing,
                frames: sourceFrames.map((frame) => ({ ...frame })),
                stats: { ...source.props.stats },
                analysis: [],
                rasterSceneViews: 0,
                hasPreview: false,
                isPublic: true,
                updatedAt: now,
                createdAt: now
            });

            await this.storagePlacementService.ensurePlacement('trajectory', destinationTrajectory.id);

            const job = await this.cloneJobRepository.create(createTrajectoryCloneJobProps({
                team: input.teamId,
                sourceTrajectoryId: source.id,
                destinationTrajectoryId: destinationTrajectory.id,
                sourceClusterId,
                destinationClusterId,
                requestedBy: input.userId,
                stats: {
                    totalFrames: sourceFrames.length
                }
            }));

            await this.cloneCoordinator.publishJobProjection(job);

            try {
                this.cloneRunner.kick(1);
            } catch (error) {
                logger.warn({ err: error }, '[CloneTrajectoryUseCase] Failed to kick clone runner');
            }

            await this.eventBus.publish(new TrajectoryCreatedEvent({
                trajectoryId: destinationTrajectory._id,
                trajectoryName: destinationTrajectory.props.name,
                teamId: input.teamId,
                userId: input.userId
            }));

            return Result.ok({
                trajectoryId: destinationTrajectory.id,
                jobId: job.id,
                sourceTrajectoryId: source.id,
                destinationClusterId
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            logger.error({ err: error }, '[CloneTrajectoryUseCase] Unexpected error');
            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to start trajectory clone',
                500
            ));
        }
    }

    private async resolveDestinationStorageClusterId(
        teamId: string,
        requestedClusterId?: string
    ): Promise<string> {
        if (!requestedClusterId) {
            return this.clusterSelectionService.resolveStorageClusterId({ teamId });
        }

        const requestedCluster = await this.teamClusterRepository.findById(requestedClusterId);
        if (!requestedCluster || requestedCluster.props.team !== teamId) {
            throw ApplicationError.notFound(
                'TeamCluster::NotFound',
                'Team cluster not found for the requested team'
            );
        }

        if (requestedCluster.props.status !== TeamClusterStatus.Connected) {
            throw ApplicationError.conflict(
                'TeamCluster::StorageClusterRequired',
                'A connected storage-capable team cluster is required for this operation'
            );
        }

        const requestedCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(
            requestedCluster.props.roleConfig
        );

        if (requestedCapabilities.acceptsStorageWrites) {
            return requestedCluster.id;
        }

        return this.clusterSelectionService.resolveStorageClusterId({
            teamId,
            preferredComputeClusterId: requestedCluster.id
        });
    }
}
