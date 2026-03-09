import type Job from '@modules/jobs/domain/entities/Job';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

export interface RoutePluginExecutionInput {
    teamClusterId: string;
    analysisId: string;
    trajectoryId: string;
    teamId: string;
    plugin: Plugin;
    jobs: Job[];
    forEachNodeId: string;
    nodeOutputSnapshots: Record<string, Record<string, unknown>>;
};

export interface IPluginExecutionRouter {
    route(input: RoutePluginExecutionInput): Promise<void>;
};
