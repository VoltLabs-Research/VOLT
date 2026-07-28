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

export enum AnalysisRelation {
    Plugin = 'plugin',
    Trajectory = 'trajectory',
    CreatedBy = 'createdBy',
    Team = 'team',
    ComputeCluster = 'computeClusterId',
    StorageCluster = 'storageClusterId'
}

export type AnalysisRelationName = `${AnalysisRelation}`;
