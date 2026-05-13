import { Command, CommandGroup } from '@/core/commands/decorators';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import type { ClusterObjectStore } from '@/core/storage/contracts/cluster-object-store';
import { mapLimited } from '@/support/concurrency/map-limited';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';

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

const buildTrajectoryDumpObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}.dump.zst`
);

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
        if (!Array.isArray(payload.frames)) {
            throw new Error('trajectory.clone requires frames');
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
        const sourceObjectKey = buildTrajectoryDumpObjectName(payload.sourceTrajectoryId, frame.timestep);
        const destinationObjectKey = buildTrajectoryDumpObjectName(payload.destinationTrajectoryId, frame.timestep);
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
