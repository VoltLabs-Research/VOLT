import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryUploadSession from '@modules/trajectory/models/TrajectoryUploadSession';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { TrajectoryUploadSessionStatus } from '@modules/trajectory/contracts/trajectory-upload-session';

import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import { replaceTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryFrameStore';
import { toTrajectoryRecord } from '@modules/trajectory/services/trajectory/trajectory-record';
import {
    discardFailedCommit,
    isNoValidFramesError,
    isUnreadableStagedObjectError,
    persistIngestedFrames,
    projectQueuedGlbJobs,
    requestTrajectoryIngest
} from '@modules/trajectory/services/trajectory/trajectory-ingest-commit';
import {
    MAX_UPLOAD_FILE_SIZE,
    UPLOAD_CHUNK_SIZE,
    UPLOAD_SESSION_TTL_SECONDS,
    planUploadFiles,
    resolveTrajectoryName,
    selectUploadableFiles,
    signUploadFiles
} from '@modules/trajectory/services/trajectory/trajectory-upload-plan';

import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import logger from '@shared/infrastructure/logger';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';

import type {
    CreateTrajectoryUploadSessionInput,
    CreateTrajectoryUploadSessionOutput,
    TrajectoryUploadSessionRequest
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import path from 'node:path';

class TrajectoryUploadSessionService {
    async create(input: CreateTrajectoryUploadSessionInput): Promise<CreateTrajectoryUploadSessionOutput> {
        const { teamId, userId, files } = input;

        const oversized = files.find((file) => file.size > MAX_UPLOAD_FILE_SIZE);
        if (oversized) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Uploaded file "${oversized.name}" declares a size of ${oversized.size} bytes; it must not exceed ${MAX_UPLOAD_FILE_SIZE} bytes`
            );
        }

        const uploadableFiles = selectUploadableFiles(files);
        const name = resolveTrajectoryName(input.name, uploadableFiles.map(({ file }) => file));

        if (!name || uploadableFiles.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one uploaded trajectory file with content is required'
            );
        }

        if (uploadableFiles.length < files.length) {
            logger.warn(
                `[TrajectoryUploadSessionService] Dropping ${files.length - uploadableFiles.length} empty file(s) from upload teamId=${teamId} name=${name}`
            );
        }

        if (input.folderId) {
            const folder = await CatalogFolder.findOneBy({
                id: input.folderId,
                team: teamId,
                kind: CatalogFolderKind.Trajectory
            });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target trajectory folder not found');
            }
        }

        const storageClusterId = await teamClusterSelectionService.resolveStorageClusterId(teamId, input.teamClusterId);
        const extension = path.extname(name);
        const now = new Date();

        const trajectory = await Trajectory.create({
            name: extension ? name.slice(0, -extension.length) : name,
            team: teamId,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: userId,
            status: TrajectoryStatus.Processing,
            stats: {
                totalFiles: 0,
                totalSize: 0
            },
            hasPreview: false,
            isPublic: true,
            updatedAt: now,
            createdAt: now
        }).save();

        await storagePlacementService.ensurePlacement('trajectory', trajectory.id);

        const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_SECONDS * 1000);
        const sessionFiles = planUploadFiles(trajectory.id, uploadableFiles);

        const uploadSession = await TrajectoryUploadSession.create({
            team: teamId,
            user: userId,
            ownerClusterId: storageClusterId,
            bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
            resourceKind: 'trajectory',
            resourceId: trajectory.id,
            files: sessionFiles,
            expiresAt
        }).save();

        await eventBus.emit('trajectory.created', {
            trajectoryId: trajectory.id,
            trajectoryName: name,
            teamId,
            userId
        });

        return {
            trajectory: toTrajectoryRecord(trajectory),
            uploadSession: {
                id: uploadSession.id,
                chunkSize: UPLOAD_CHUNK_SIZE,
                expiresAt: expiresAt.toISOString(),
                files: signUploadFiles({
                    teamId,
                    userId,
                    storageClusterId,
                    trajectoryId: trajectory.id,
                    sessionId: uploadSession.id,
                    files: sessionFiles
                })
            }
        };
    }

    async commit(input: TrajectoryUploadSessionRequest): Promise<{ trajectoryId: string }> {
        const session = await this.#requireOwnedSession(input);
        const trajectoryId = session.resourceId;

        if (session.status === TrajectoryUploadSessionStatus.Committed) {
            return { trajectoryId };
        }

        this.#assertCommittable(session);

        try {
            const result = await requestTrajectoryIngest(session, input.teamId);

            const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
            const frames = await persistIngestedFrames(trajectoryId, input.teamId, result.frames);

            if (trajectory) {
                await Object.assign(trajectory, {
                    status: TrajectoryStatus.Processing,
                    stats: result.stats
                }).save();
            }
            await replaceTrajectoryFrames(trajectoryId, frames);

            await projectQueuedGlbJobs(
                trajectoryId,
                trajectory?.name || 'Trajectory',
                input.teamId,
                session.ownerClusterId,
                frames
            );

            await Object.assign(session, {
                status: TrajectoryUploadSessionStatus.Committed
            }).save();

            await eventBus.emit('trajectory.updated', {
                trajectoryId,
                teamId: input.teamId,
                updates: {
                    status: TrajectoryStatus.Processing,
                    stats: result.stats
                },
                updatedAt: new Date()
            });

            return { trajectoryId };
        } catch (error: unknown) {
            logger.error(error, `[TrajectoryUploadSessionService] Commit failed for uploadSessionId=${session.id}`);
            await discardFailedCommit(session.id, trajectoryId, input);

            if (isUnreadableStagedObjectError(error)) {
                throw ApplicationError.unprocessableEntity(
                    ErrorCodes.TRAJECTORY_CREATION_STAGED_OBJECT_UNREADABLE,
                    'The upload reached the storage cluster but one of its files could not be read back for ingestion. This is a problem on our side, not with the file — retry the upload, and if it keeps failing the cluster logs carry the reason.'
                );
            }

            if (isNoValidFramesError(error)) {
                throw ApplicationError.unprocessableEntity(
                    ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES,
                    'None of the uploaded files contain readable trajectory frames. Upload a supported trajectory dump (e.g. a LAMMPS dump, XYZ, or a ZIP of frames).'
                );
            }

            throw error;
        }
    }

    async cancel(input: TrajectoryUploadSessionRequest): Promise<void> {
        const session = await this.#requireOwnedSession(input);

        if (session.status === TrajectoryUploadSessionStatus.Committed) {
            throw ApplicationError.conflict(
                ErrorCodes.TRAJECTORY_UPLOAD_SESSION_ALREADY_COMMITTED,
                'Committed upload sessions cannot be cancelled'
            );
        }

        const ownerClusterId = session.ownerClusterId;
        const discardObject = (objectKey: string): Promise<void> => (
            objectGatewayClient.deleteObject(ownerClusterId, session.bucket, objectKey).catch((error) => {
                logger.debug(error, `[TrajectoryUploadSessionService] Failed to delete ${objectKey}`);
            })
        );

        await Promise.all(session.files.flatMap((file) => [
            discardObject(file.finalObjectKey),
            ...file.parts.map((part) => discardObject(part.objectKey))
        ]));

        await Object.assign(session, { status: TrajectoryUploadSessionStatus.Cancelled }).save();
        await Trajectory.update({ id: session.resourceId }, { status: TrajectoryStatus.Failed }).catch(() => {});
    }

    async #requireOwnedSession(input: TrajectoryUploadSessionRequest): Promise<TrajectoryUploadSession> {
        const session = await TrajectoryUploadSession.findOneBy({ id: input.uploadSessionId });
        if (!session) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_UPLOAD_SESSION_NOT_FOUND, 'Upload session not found');
        }
        if (session.team !== input.teamId || session.user !== input.userId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TRAJECTORY_UPLOAD_SESSION_FORBIDDEN,
                'Upload session does not belong to this user and team'
            );
        }

        return session;
    }

    #assertCommittable(session: TrajectoryUploadSession): void {
        if (session.status !== TrajectoryUploadSessionStatus.Pending) {
            throw ApplicationError.conflict(ErrorCodes.TRAJECTORY_UPLOAD_SESSION_NOT_PENDING, 'Upload session is not pending');
        }
        if (session.expiresAt.getTime() <= Date.now()) {
            throw ApplicationError.badRequest(ErrorCodes.TRAJECTORY_UPLOAD_SESSION_EXPIRED, 'Upload session has expired');
        }
        if (session.resourceKind !== 'trajectory') {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_UPLOAD_SESSION_UNSUPPORTED_RESOURCE,
                'Upload session is not a trajectory upload'
            );
        }
    }
}

export default new TrajectoryUploadSessionService();
