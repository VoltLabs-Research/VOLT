import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryUploadSession from '@modules/trajectory/models/TrajectoryUploadSession';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { TrajectoryUploadSessionStatus } from '@modules/trajectory/contracts/trajectory-upload-session';

import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import { replaceTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryFrameStore';
import { toTrajectoryRecord } from '@modules/trajectory/services/trajectory/trajectory-record';
import {
    discardFailedCommit,
    isNoValidFramesError,
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
    /**
     * Creates the trajectory row up front so the client can upload against
     * signed per-part URLs, then waits for an explicit commit.
     */
    async create(input: CreateTrajectoryUploadSessionInput): Promise<CreateTrajectoryUploadSessionOutput> {
        const { teamId, userId, files } = input;
        const name = resolveTrajectoryName(input.name, files);

        if (!name || files.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one uploaded trajectory file is required'
            );
        }

        /*
         * The declared size drives the part plan, so an out-of-range value would have us
         * mint one signed URL per 64 MiB of a size the caller invented. Bound it before
         * anything is created.
         */
        const invalidSize = files.find((file) => file.size <= 0 || file.size > MAX_UPLOAD_FILE_SIZE);
        if (invalidSize) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Uploaded file "${invalidSize.name}" declares a size of ${invalidSize.size} bytes; it must be between 1 and ${MAX_UPLOAD_FILE_SIZE} bytes`
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
            rasterSceneViews: 0,
            hasPreview: false,
            isPublic: true,
            updatedAt: now,
            createdAt: now
        }).save();

        await storagePlacementService.ensurePlacement('trajectory', trajectory.id);

        const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_SECONDS * 1000);
        const sessionFiles = planUploadFiles(trajectory.id, files);

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

    /**
     * Hands the staged objects to the owning daemon for ingestion. A failed
     * ingest discards the placeholder trajectory so no empty row survives.
     */
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
                status: TrajectoryUploadSessionStatus.Committed,
                committedAt: new Date()
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

            if (isNoValidFramesError(error)) {
                throw ApplicationError.unprocessableEntity(
                    ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES,
                    'The uploaded file does not contain any readable trajectory frames. Upload a supported trajectory dump (e.g. a LAMMPS dump, XYZ, or a ZIP of frames).'
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

    /**
     * Loads the addressed session and authorizes the caller. The session id is a
     * bearer-ish handle, so the team/user match is authorization rather than input
     * validation, and it gates every transition including a repeated commit.
     */
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
