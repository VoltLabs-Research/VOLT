import type { Types } from 'mongoose';

export interface AnalysisProvenance {
    _id?: string | Types.ObjectId;
    pluginName: string;
    pluginVersion: string;
    parameters: Record<string, unknown>;
    inputFrameContentHash: string;
    inputFrameMetadata: {
        atomCount: number;
        frameIndex: number;
        trajectoryId: string;
    };
    coreToolkitVersion: string;
    rngSeed?: number;
    executedAt: Date;
    executedBy: string;
    executionTimeMs: number;
    outputArtifactIds: string[];
    reproductionCommand: string;
}
