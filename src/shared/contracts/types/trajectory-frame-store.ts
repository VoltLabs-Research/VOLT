import type { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type {
    ColumnDType,
    TypedColumn,
    ElementTableEntry,
    LammpsUnits
} from '@shared/domain/catalog';

export type { ColumnDType, TypedColumn, ElementTableEntry, LammpsUnits };

export interface TrajectoryFrameData {
    timestep: number;
    atomCount: number;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties: Record<string, TypedColumn>;
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
    units: LammpsUnits;
    elementTable: ElementTableEntry[];
}

export interface TrajectoryElementMetadata {
    units: LammpsUnits;
    elementTable: ElementTableEntry[];
}

export interface TrajectoryFrameLookupInput {
    trajectoryId: string;
    ownerClusterId: string;
    timestep: number;
}

export interface TrajectoryFrameStore {
    ingest(input: TrajectoryFrameStoreIngestInput): Promise<TrajectoryFrameStoreIngestResult>;
    readFrame(input: TrajectoryFrameLookupInput): Promise<TrajectoryFrameData>;
    readElementMetadata(input: { trajectoryId: string; ownerClusterId: string }): Promise<TrajectoryElementMetadata>;
}
