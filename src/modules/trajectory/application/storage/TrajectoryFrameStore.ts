import type { ObjectBucketName } from '@/core/storage/contracts/http-object-store';

export interface TrajectoryFrameData {
    timestep: number;
    atomCount: number;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties: Record<string, Float32Array>;
    frameBbox: readonly [number, number, number, number, number, number];
}

export interface TrajectoryFrameSource {
    timestep: number;
    dumpPath: string;
}

export interface TrajectoryFrameStoreIngestInput {
    trajectoryId: string;
    ownerClusterId: string;
    frames: TrajectoryFrameSource[];
    customProperties?: string[];
}

export interface TrajectoryFrameStoreIngestResult {
    objectKey: string;
    frameCount: number;
    size: number;
    bucket: ObjectBucketName;
}

export interface TrajectoryFrameLookupInput {
    trajectoryId: string;
    ownerClusterId: string;
    timestep: number;
}

export interface TrajectoryFrameStore {
    ingest(input: TrajectoryFrameStoreIngestInput): Promise<TrajectoryFrameStoreIngestResult>;
    readFrame(input: TrajectoryFrameLookupInput): Promise<TrajectoryFrameData>;
}
