import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import JobsService from '@modules/jobs/services/JobsService';
import type { TrajectoryRefInput } from '@volt/contracts/modules/jobs/ai-tools';

@AIToolProvider()
export default class JobsAIToolController extends AIToolController {
    #service = new JobsService();

    @AITool({
        name: 'retry_team_failed_jobs',
        description: 'Retry all failed jobs for a trajectory in the team.',
        parameters: typia.llm.parameters<TrajectoryRefInput>(),
        validate: typia.createValidate<TrajectoryRefInput>()
    })
    async retryTeamFailedJobs(input: TrajectoryRefInput & AIToolScope) {
        const value = await this.#service.retryFailedJobs(input);
        return {
            summary: `Retried ${value.retriedFrames} frames across ${value.affectedClusters} clusters.`,
            data: value
        };
    }

    @AITool({
        name: 'remove_team_running_jobs',
        description: 'Remove all running jobs for a trajectory in the team.',
        parameters: typia.llm.parameters<TrajectoryRefInput>(),
        validate: typia.createValidate<TrajectoryRefInput>()
    })
    async removeTeamRunningJobs(input: TrajectoryRefInput & AIToolScope) {
        const value = await this.#service.removeRunningJobs(input);
        return {
            summary: `Removed ${value.deletedJobs} jobs across ${value.affectedClusters} clusters.`,
            data: value
        };
    }
}
