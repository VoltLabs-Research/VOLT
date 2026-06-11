import { Readable } from 'node:stream';

import type { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';
import type {
    LineExportBaseOptions,
    LineStyleFilterParam,
    LineStyleParams,
    TrajectoryNativeLineModelResponse,
    TrajectoryNativeObjectStreamResponse
} from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

export type {
    LineExportBaseOptions,
    LineStyleFilterParam,
    LineStyleParams,
    TrajectoryNativeLineModelResponse,
    TrajectoryNativeObjectStreamResponse
} from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

export interface TrajectoryNativeRequestInput {
    teamClusterId: string;
    trajectoryId: string;
    timestep: string | number;
    objectKey?: string;
    ownerClusterId?: string;
}

export interface TrajectoryNativePropertyRequestInput extends TrajectoryNativeRequestInput {
    property: string;
}

export interface TrajectoryNativeUniqueValuesRequestInput extends TrajectoryNativePropertyRequestInput {
    maxValues?: number;
}

export interface TrajectoryNativeAtomsPageRequestInput extends TrajectoryNativeRequestInput {
    page: number;
    limit: number;
    analysisId?: string;
}

export interface TrajectoryNativeFilterPreviewRequestInput extends TrajectoryNativeRequestInput {
    analysisId?: string;
    exposureId?: string;
    property: string;
    operator: string;
    value: number | string;
    externalValues?: Float32Array;
}

export interface TrajectoryNativeColorModelRequestInput extends TrajectoryNativePropertyRequestInput {
    analysisId?: string;
    exposureId?: string;
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValues?: Float32Array;
}

export interface TrajectoryNativeParticleFilterRequestInput extends TrajectoryNativeRequestInput {
    objectKey: string;
    action: 'delete' | 'highlight';
    mask: Uint8Array;
}

export interface TrajectoryNativeLineModelRequestInput extends TrajectoryNativeRequestInput {
    objectKey: string;
    analysisId: string;
    exposureId: string;
    baseOptions?: LineExportBaseOptions;
    style?: LineStyleParams;
}

export interface TrajectoryNativeAtomsPageResult {
    atoms: Array<{
        id: number;
        type: number;
        x: number;
        y: number;
        z: number;
        [property: string]: number;
    }>;
    totalAtoms: number;
    nativeProperties: string[];
    analysisPropertyNames?: string[];
    analysisAtoms?: Record<string, unknown>[];
}

export interface ITrajectoryNativeDaemonService {
    preprocessTrajectory(input: TrajectoryNativeRequestInput): Promise<void>;
    getTrajectoryMetadata(input: TrajectoryNativeRequestInput): Promise<FrameMetadata>;
    getPropertyStats(input: TrajectoryNativePropertyRequestInput): Promise<{ min: number; max: number }>;
    getUniqueValues(input: TrajectoryNativeUniqueValuesRequestInput): Promise<number[]>;
    getAtomIds(input: TrajectoryNativeRequestInput): Promise<number[]>;
    getAtomsPage(input: TrajectoryNativeAtomsPageRequestInput): Promise<TrajectoryNativeAtomsPageResult>;
    previewFilter(
        input: TrajectoryNativeFilterPreviewRequestInput
    ): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number }>;
    exportColoredModel(input: TrajectoryNativeColorModelRequestInput): Promise<void>;
    exportParticleFilterModel(input: TrajectoryNativeParticleFilterRequestInput): Promise<{ atomsResult: number }>;
    exportLineModel(input: TrajectoryNativeLineModelRequestInput): Promise<TrajectoryNativeLineModelResponse>;
    getObjectBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer>;
    getObjectStream(teamClusterId: string, bucket: string, objectKey: string): Promise<Readable>;
    getObjectStreamResponse(
        teamClusterId: string,
        bucket: string,
        objectKey: string
    ): Promise<TrajectoryNativeObjectStreamResponse>;
}
