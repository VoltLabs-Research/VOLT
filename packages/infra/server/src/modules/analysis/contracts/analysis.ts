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
