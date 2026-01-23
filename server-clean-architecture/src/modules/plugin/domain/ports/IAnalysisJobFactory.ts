import Job from '@modules/jobs/domain/entities/Job';
import Plugin from '@modules/plugin/domain/entities/Plugin';

export interface AnalysisJobCreateInput {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    plugin: Plugin;
    items: any[];
    config: Record<string, any>;
}

export interface IAnalysisJobFactory {
    create(input: AnalysisJobCreateInput): Job[];
}
