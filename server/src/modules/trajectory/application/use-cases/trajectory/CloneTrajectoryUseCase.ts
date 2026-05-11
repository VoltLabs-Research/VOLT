import { ErrorCodes } from '@core/constants/error-codes';
import { ClusterRoleAwareSelectionService } from '@modules/container/infrastructure/services/ClusterRoleAwareSelectionService';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { resolveEffectiveCapabilitiesFromRoleConfig, TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import {
    CloneTrajectoryInputDTO,
    CloneTrajectoryOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/CloneTrajectoryDTO';
import TrajectoryCloneCoordinator from '@modules/trajectory/application/services/TrajectoryCloneCoordinator';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { createTrajectoryCloneJobProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import type { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TrajectoryCloneJobRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryCloneJobRepository';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryCloneRunner from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryCloneRunner';
import { inject } from 'tsyringe';

@Singleton()
export default class CloneTrajectoryUseCase implements IUseCase<
    CloneTrajectoryInputDTO,
    CloneTrajectoryOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository,

        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly cloneJobRepository: TrajectoryCloneJobRepository,

        
        private readonly cloneCoordinator: TrajectoryCloneCoordinator,

        
        private readonly cloneRunner: TrajectoryCloneRunner,

        
        private readonly storagePlacementService: StoragePlacementService,

        
        private readonly teamClusterRepository: TeamClusterRepository,

        
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

            const sourceClusterId = resolveTrajectoryStorageClusterId(source.props);
            if (!sourceClusterId) {
                throw ApplicationError.conflict(
                    'TrajectoryClone::StorageClusterRequired',
                    'Source trajectory does not have a storage cluster assigned'
                );
            }
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
