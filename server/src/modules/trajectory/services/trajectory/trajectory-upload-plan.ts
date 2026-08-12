import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import ClusterObjectSignedUrlService from '@modules/cluster/services/object-store/ClusterObjectSignedUrlService';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

import type {
    TrajectoryUploadSessionFileProps,
    TrajectoryUploadSessionPartProps
} from '@modules/trajectory/contracts/trajectory-upload-session';
import type {
    TrajectoryUploadFileInput,
    TrajectoryUploadSessionFileView
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import path from 'node:path';

const DEFAULT_UPLOAD_CHUNK_SIZE = 64 * 1024 * 1024;
const DEFAULT_UPLOAD_SESSION_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_MAX_UPLOAD_FILE_SIZE = 512 * 1024 * 1024 * 1024;

export const UPLOAD_CHUNK_SIZE = readPositiveIntegerEnv('TRAJECTORY_UPLOAD_CHUNK_SIZE', DEFAULT_UPLOAD_CHUNK_SIZE);
export const UPLOAD_SESSION_TTL_SECONDS = readPositiveIntegerEnv(
    'TRAJECTORY_UPLOAD_SESSION_TTL_SECONDS',
    DEFAULT_UPLOAD_SESSION_TTL_SECONDS
);
export const MAX_UPLOAD_FILE_SIZE = readPositiveIntegerEnv(
    'TRAJECTORY_UPLOAD_MAX_FILE_SIZE',
    DEFAULT_MAX_UPLOAD_FILE_SIZE
);

const signedUrlService = new ClusterObjectSignedUrlService();

interface SignUploadFilesInput {
    teamId: string;
    userId: string;
    storageClusterId: string;
    trajectoryId: string;
    sessionId: string;
    files: TrajectoryUploadSessionFileProps[];
}

export const resolveTrajectoryName = (
    requestedName: string | undefined,
    files: TrajectoryUploadFileInput[]
): string | null => {
    const normalizedRequestedName = requestedName?.trim();
    if (normalizedRequestedName) return normalizedRequestedName;

    const firstFileName = files[0]?.name?.trim();
    return firstFileName ? path.basename(firstFileName) : null;
};

const buildUploadParts = (
    trajectoryId: string,
    fileIndex: number,
    finalObjectKey: string,
    size: number
): TrajectoryUploadSessionPartProps[] => {
    if (size <= UPLOAD_CHUNK_SIZE) {
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
        const partSize = Math.min(UPLOAD_CHUNK_SIZE, size - offset);
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

export const planUploadFiles = (
    trajectoryId: string,
    files: TrajectoryUploadFileInput[]
): TrajectoryUploadSessionFileProps[] => files.map((file, index) => {
    const finalObjectKey = `trajectory-staging/${trajectoryId}/${index}-${path.basename(file.name || 'upload')}`;
    return {
        index,
        originalName: file.name,
        ...(file.type ? { contentType: file.type } : {}),
        size: file.size,
        finalObjectKey,
        parts: buildUploadParts(trajectoryId, index, finalObjectKey, file.size)
    };
});

export const signUploadFiles = (input: SignUploadFilesInput): TrajectoryUploadSessionFileView[] => (
    input.files.map((file) => ({
        index: file.index,
        originalName: file.originalName,
        size: file.size,
        ...(file.contentType ? { contentType: file.contentType } : {}),
        finalObjectKey: file.finalObjectKey,
        parts: file.parts.map((part) => {
            const signed = signedUrlService.createToken({
                kind: 'cluster-object',
                operation: 'write',
                teamId: input.teamId,
                userId: input.userId,
                ownerClusterId: input.storageClusterId,
                bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
                objectKey: part.objectKey,
                resourceKind: 'trajectory',
                resourceId: input.trajectoryId,
                contentLength: part.size,
                contentType: file.contentType || 'application/octet-stream',
                sessionId: input.sessionId,
                partNumber: part.partNumber
            }, UPLOAD_SESSION_TTL_SECONDS);

            return {
                partNumber: part.partNumber,
                offset: part.offset,
                size: part.size,
                url: signed.url,
                expiresAt: signed.expiresAt
            };
        })
    }))
);
