import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '@modules/trajectory/application/dtos/trajectory/CreateTrajectoryDTO';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';

import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryBackgroundProcessor';
import path from 'node:path';
import { inject, injectable } from 'tsyringe';

interface InitialTrajectoryStats {
    totalFiles: number;
    totalSize: number;
};

const resolveTrajectoryName = (
    requestedName: string | undefined,
    files: CreateTrajectoryInputDTO['files']
): string | null => {
    const normalizedRequestedName = requestedName?.trim();
    if (normalizedRequestedName) {
        return normalizedRequestedName;
    }

    const [firstFile] = files;
    if (!firstFile) {
        return null;
    }

    const originalName = firstFile.originalname?.trim();
    if (originalName) {
        return path.basename(originalName);
    }

    if (firstFile.path) {
        return path.basename(firstFile.path);
    }

    return null;
};

@injectable()
export default class CreateTrajectoryUseCase implements IUseCase<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryRepo: TrajectoryRepository,

        
        private readonly trajectoryFolderRepository: TrajectoryFolderRepository,

        
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        
        private readonly backgroundProcessor: TrajectoryBackgroundProcessor,

        
        private readonly storagePlacementService: StoragePlacementService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTrajectoryInputDTO): Promise<Result<CreateTrajectoryOutputDTO, ApplicationError>> {
        const { teamId, userId, files } = input;
        const name = resolveTrajectoryName(input.name, files);

        if (!name) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one uploaded trajectory file is required'
            ));
        }

        if (input.folderId) {
            const folder = await this.trajectoryFolderRepository.findByTeamAndFolderId(teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Target trajectory folder not found'
                ));
            }
        }

        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(
            teamId,
            input.teamClusterId
        );

        const ext = path.extname(name);
        const cleanName = ext ? name.slice(0, -ext.length) : name;
        const stats: InitialTrajectoryStats = {
            totalFiles: 0,
            totalSize: 0
        };

        const trajectory = await this.trajectoryRepo.create({
            name: cleanName,
            team: teamId,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: userId,
            status: TrajectoryStatus.WaitingForProcess,
            stats,
            analysis: [],
            rasterSceneViews: 0,
            hasPreview: false,
            isPublic: true,
            updatedAt: new Date(),
            createdAt: new Date()
        });

        await this.storagePlacementService.ensurePlacement('trajectory', trajectory.id);

        this.backgroundProcessor.process(trajectory._id, files, teamId).catch(async err => {
            logger.error(err, `[CreateTrajectoryUseCase] Background processing failed for ${trajectory._id}`);
            await this.trajectoryRepo.updateById(trajectory._id, { status: TrajectoryStatus.Failed }).catch(() => { });
        });

        await this.eventBus.publish(new TrajectoryCreatedEvent({
            trajectoryId: trajectory._id,
            trajectoryName: name,
            teamId,
            userId
        }));

        return Result.ok(toPersistedOutput(trajectory));
    }
};
