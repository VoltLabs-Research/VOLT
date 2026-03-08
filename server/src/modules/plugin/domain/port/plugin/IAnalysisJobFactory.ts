import Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

import Job from '@modules/jobs/domain/entities/Job';

export interface AnalysisJobCreateInput {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    plugin: Plugin;
    items: Record<string, unknown>[];
    config: Record<string, unknown>;
};

export interface IAnalysisJobFactory {
    create(input: AnalysisJobCreateInput): Job[];
};
