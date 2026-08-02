import { assertWireMatch } from '@shared/contracts/assert-wire-match';
import type { Equal } from '@shared/contracts/assert-wire-match';
import type { AnalysisArtifactStatus as WireAnalysisArtifactStatus } from '@volt/contracts/modules/analysis/domain';

export enum AnalysisStatus {
    Pending = 'pending',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
}

export enum AnalysisArtifactStatus {
    Pending = 'pending',
    Generating = 'generating',
    Uploading = 'uploading',
    Ready = 'ready',
    Failed = 'failed'
}

/*
 * This enum exists because the server needs the values at runtime, while
 * `@volt/contracts` declares the same set as a union. The assertion fails the
 * build if the two ever stop matching.
 */
assertWireMatch<Equal<`${AnalysisArtifactStatus}`, WireAnalysisArtifactStatus>>();

export enum AnalysisRelation {
    Plugin = 'plugin',
    Trajectory = 'trajectory',
    CreatedBy = 'createdBy',
    Team = 'team',
    ComputeCluster = 'computeClusterId',
    StorageCluster = 'storageClusterId'
}

export type AnalysisRelationName = `${AnalysisRelation}`;
