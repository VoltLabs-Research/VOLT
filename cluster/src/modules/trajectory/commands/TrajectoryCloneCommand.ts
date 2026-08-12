import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { toTrajectoryFrameDumpObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { mapLimited } from '@shared/application/utilities/map-limited';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

interface TrajectoryCloneFramePayload {
    timestep: number | string;
    size?: number;
}

interface TrajectoryClonePayload {
    sourceTrajectoryId: string;
    destinationTrajectoryId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    frames: TrajectoryCloneFramePayload[];
}

interface TrajectoryCloneResult {
    copiedFrames: number;
    copiedBytes: number;
}

const TRAJECTORY_CLONE_CONCURRENCY = readPositiveIntegerEnv('TRAJECTORY_CLONE_CONCURRENCY') ?? 8;

const readFrameTimestep = (frame: TrajectoryCloneFramePayload): number => {
    const timestep = typeof frame.timestep === 'string' ? Number(frame.timestep) : frame.timestep;

    if (!Number.isInteger(timestep)) {
        throw ApplicationError.badRequest(
            ErrorCodes.TRAJECTORY_CLONE_INVALID_TIMESTEP,
            `Clone frame timestep must be an integer, received "${String(frame.timestep)}"`
        );
    }

    return timestep;
};

@CommandGroup('trajectory')
export class TrajectoryCloneCommand {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    @Command('clone')
    async clone(payload: TrajectoryClonePayload): Promise<TrajectoryCloneResult> {
        if (!payload.sourceTrajectoryId || !payload.destinationTrajectoryId) {
            throw new Error('trajectory.clone requires sourceTrajectoryId and destinationTrajectoryId');
        }
        if (!payload.sourceClusterId || !payload.destinationClusterId) {
            throw new Error('trajectory.clone requires sourceClusterId and destinationClusterId');
        }

        const results = await mapLimited(
            payload.frames,
            TRAJECTORY_CLONE_CONCURRENCY,
            async (frame) => this.copyFrame(payload, frame)
        );

        return {
            copiedFrames: results.length,
            copiedBytes: results.reduce((sum, value) => sum + value, 0)
        };
    }

    private async copyFrame(payload: TrajectoryClonePayload, frame: TrajectoryCloneFramePayload): Promise<number> {
        const timestep = readFrameTimestep(frame);
        const sourceObjectKey = toTrajectoryFrameDumpObjectKey(payload.sourceTrajectoryId, timestep);
        const destinationObjectKey = toTrajectoryFrameDumpObjectKey(payload.destinationTrajectoryId, timestep);
        const source = await this.objectStore.getStream(
            payload.sourceClusterId,
            ObjectBucketName.Dumps,
            sourceObjectKey
        );
        const contentLength = source.contentLength ?? frame.size;

        if (!contentLength || contentLength <= 0) {
            throw new Error(`trajectory.clone could not determine object size for ${sourceObjectKey}`);
        }

        await this.objectStore.putObjectStream({
            ownerClusterId: payload.destinationClusterId,
            bucket: ObjectBucketName.Dumps,
            objectKey: destinationObjectKey,
            stream: source.stream,
            size: contentLength,
            metadata: {
                ...source.metadata,
                ...(source.contentType ? { 'Content-Type': source.contentType } : {}),
                ...(source.contentEncoding ? { 'Content-Encoding': source.contentEncoding } : {})
            }
        });

        return contentLength;
    }
}

export const getTrajectoryCloneCommand = commandGroupFactory(TrajectoryCloneCommand, () => new TrajectoryCloneCommand(getObjectStore()));
