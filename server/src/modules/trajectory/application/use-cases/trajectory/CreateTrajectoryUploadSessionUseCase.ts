import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import ClusterObjectSignedUrlService from '@modules/cluster/infrastructure/services/ClusterObjectSignedUrlService';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import type {
    TrajectoryUploadSessionFileProps,
    TrajectoryUploadSessionPartProps
} from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryUploadSessionModel';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryUploadSessionRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryUploadSessionRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import path from 'node:path';
import { inject, injectable } from 'tsyringe';

import type {
    CreateTrajectoryUploadSessionInputDTO,
    CreateTrajectoryUploadSessionOutputDTO,
    TrajectoryUploadSessionFileDTO,
    TrajectoryUploadSessionFileInput
} from '@modules/trajectory/application/dtos/trajectory/TrajectoryUploadSessionDTO';

const DEFAULT_UPLOAD_CHUNK_SIZE = 64 * 1024 * 1024;
const DEFAULT_UPLOAD_SESSION_TTL_SECONDS = 6 * 60 * 60;
const TRAJECTORY_UPLOAD_CHUNK_SIZE = readPositiveIntegerEnv('TRAJECTORY_UPLOAD_CHUNK_SIZE', DEFAULT_UPLOAD_CHUNK_SIZE);
const TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS = readPositiveIntegerEnv(
    'TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS',
    DEFAULT_UPLOAD_SESSION_TTL_SECONDS
);

const resolveTrajectoryName = (
    requestedName: string | undefined,
    files: TrajectoryUploadSessionFileInput[]
): string | null => {
    const normalizedRequestedName = requestedName?.trim();
    if (normalizedRequestedName) return normalizedRequestedName;

    const firstFileName = files[0]?.name?.trim();
    return firstFileName ? path.basename(firstFileName) : null;
};

const safeObjectName = (name: string): string => path.basename(name || 'upload');

const buildParts = (
    trajectoryId: string,
    fileIndex: number,
    finalObjectKey: string,
    size: number
): TrajectoryUploadSessionPartProps[] => {
    if (size <= TRAJECTORY_UPLOAD_CHUNK_SIZE) {
        return [{
            partNumber: 1,
            objectKey: finalObjectKey,
            offset: 0,
            size
        }];
    }

    const parts: TrajectoryUploadSessionPartProps[] = [];
    let offset = 0;
    let partNumber = 1;

    while (offset < size) {
        const partSize = Math.min(TRAJECTORY_UPLOAD_CHUNK_SIZE, size - offset);
        parts.push({
            partNumber,
            objectKey: `trajectory-staging/${trajectoryId}/parts/${fileIndex}/${partNumber}`,
            offset,
            size: partSize
        });
        offset += partSize;
        partNumber += 1;
    }

    return parts;
};

@injectable()
export default class CreateTrajectoryUploadSessionUseCase implements IUseCase<
    CreateTrajectoryUploadSessionInputDTO,
    CreateTrajectoryUploadSessionOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly trajectoryRepo: TrajectoryRepository,
        private readonly trajectoryFolderRepository: TrajectoryFolderRepository,
        private readonly teamClusterSelectionService: TeamClusterSelectionService,
        private readonly storagePlacementService: StoragePlacementService,
        private readonly uploadSessionRepository: TrajectoryUploadSessionRepository,
        private readonly signedUrlService: ClusterObjectSignedUrlService,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateTrajectoryUploadSessionInputDTO): Promise<Result<CreateTrajectoryUploadSessionOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;
        const files = Array.isArray(input.files) ? input.files : [];
        const name = resolveTrajectoryName(input.name, files);

        if (!name || files.length === 0) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one uploaded trajectory file is required'
            ));
        }

        if (files.some((file) => !file.name || !Number.isFinite(file.size) || file.size <= 0)) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Each uploaded trajectory file must include a name and positive size'
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

        const trajectory = await this.trajectoryRepo.create({
            name: cleanName,
            team: teamId,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: userId,
            status: TrajectoryStatus.Processing,
            stats: { totalFiles: 0, totalSize: 0 },
            analysis: [],
            rasterSceneViews: 0,
            hasPreview: false,
            isPublic: true,
            updatedAt: new Date(),
            createdAt: new Date()
        });

        await this.storagePlacementService.ensurePlacement('trajectory', trajectory.id);

        const expiresAt = new Date(Date.now() + TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS * 1000);
        const sessionFiles: TrajectoryUploadSessionFileProps[] = files.map((file, index) => {
            const finalObjectKey = `trajectory-staging/${trajectory.id}/${index}-${safeObjectName(file.name)}`;
            return {
                index,
                originalName: file.name,
                ...(file.type ? { contentType: file.type } : {}),
                size: file.size,
                finalObjectKey,
                parts: buildParts(trajectory.id, index, finalObjectKey, file.size)
            };
        });

        const uploadSession = await this.uploadSessionRepository.create({
            team: teamId,
            user: userId,
            ownerClusterId: storageClusterId,
            bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
            resourceKind: 'trajectory',
            resourceId: trajectory.id,
            files: sessionFiles,
            expiresAt
        });

        await this.eventBus.publish(new TrajectoryCreatedEvent({
            trajectoryId: trajectory._id,
            trajectoryName: name,
            teamId,
            userId
        }));

        const filesOutput: TrajectoryUploadSessionFileDTO[] = sessionFiles.map((file) => ({
            index: file.index,
            originalName: file.originalName,
            size: file.size,
            ...(file.contentType ? { contentType: file.contentType } : {}),
            finalObjectKey: file.finalObjectKey,
            parts: file.parts.map((part) => {
                const signed = this.signedUrlService.createToken({
                    kind: 'cluster-object',
                    operation: 'write',
                    teamId,
                    userId,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
                    objectKey: part.objectKey,
                    resourceKind: 'trajectory',
                    resourceId: trajectory.id,
                    contentLength: part.size,
                    contentType: file.contentType || 'application/octet-stream',
                    sessionId: uploadSession.id,
                    partNumber: part.partNumber
                }, TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS);

                return {
                    partNumber: part.partNumber,
                    offset: part.offset,
                    size: part.size,
                    url: signed.url,
                    expiresAt: signed.expiresAt
                };
            })
        }));

        return Result.ok({
            trajectory: toPersistedOutput(trajectory),
            uploadSession: {
                id: uploadSession.id,
                chunkSize: TRAJECTORY_UPLOAD_CHUNK_SIZE,
                expiresAt: expiresAt.toISOString(),
                files: filesOutput
            }
        });
    }
}
