import type { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type {
    ColumnDType,
    TypedColumn,
    ElementTableEntry
} from '@shared/domain/catalog/element-table';
import type { LammpsUnits } from '@shared/domain/catalog/units';

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

export interface TrajectoryPropertyStats {
    min: number;
    max: number;
    dtype: ColumnDType;
}

/** A contiguous slice of a frame plus the frame's real atom count. */
export interface TrajectoryFramePage {
    frame: TrajectoryFrameData;
    totalAtoms: number;
}

export interface TrajectoryFrameRange {
    startIndex: number;
    endIndexExclusive: number;
}

export interface TrajectoryFrameStore {
    ingest(input: TrajectoryFrameStoreIngestInput): Promise<TrajectoryFrameStoreIngestResult>;
    readFrame(input: TrajectoryFrameLookupInput): Promise<TrajectoryFrameData>;
    readElementMetadata(input: { trajectoryId: string; ownerClusterId: string }): Promise<TrajectoryElementMetadata>;
    /**
     * Reads only the atoms in `range`. Optional because it is an optimisation: a
     * caller that cannot use it decodes the whole frame, which is correct but costs
     * O(atoms) for a request that returns a page.
     */
    readFrameRange?(input: TrajectoryFrameLookupInput, range: TrajectoryFrameRange): Promise<TrajectoryFramePage>;
    /** The frame if it is already resident, without reading anything. */
    peekFrame?(input: TrajectoryFrameLookupInput): TrajectoryFrameData | null;
    /**
     * min/max for one column, computed by the store. Returns null when the column is
     * not a stored one, so the caller falls back to reading the frame. Optional for
     * the same reason as `readFrameRange`.
     */
    readPropertyStats?(input: TrajectoryFrameLookupInput, property: string): Promise<TrajectoryPropertyStats | null>;
}
