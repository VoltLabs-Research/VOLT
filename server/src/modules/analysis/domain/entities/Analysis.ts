export type AnalysisConfig = Record<string, unknown>;

export interface AnalysisProps {
    plugin: string;
    pluginDisplayName: string;
    computeClusterId?: string;
    storageClusterId?: string;
    config: AnalysisConfig;
    trajectory: string;
    createdBy: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Analysis {
    readonly _id: string;
    props: AnalysisProps;
}

export const createAnalysis = (_id: string, props: AnalysisProps): Analysis => ({
    _id,
    props
});

export default Analysis;
