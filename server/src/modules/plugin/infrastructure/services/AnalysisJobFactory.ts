import { injectable } from 'tsyringe';
import { IAnalysisJobFactory, AnalysisJobCreateInput } from '@modules/plugin/domain/ports/IAnalysisJobFactory';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';

/**
 * Factory for creating analysis jobs from ForEach items.
 * Replicates the createJobs() logic from legacy server/services/plugin/execution.ts
 */
@injectable()
export default class AnalysisJobFactory implements IAnalysisJobFactory {
    create(input: AnalysisJobCreateInput): Job[] {
        const { analysisId, teamId, trajectoryId, trajectoryName, plugin, items, config } = input;
        const pluginSlug = plugin.props.slug;
        const modifierName = plugin.props.workflow?.props.nodes.find(
            (n) => n.type === 'modifier'
        )?.data?.modifier?.name || pluginSlug;

        return items.map((item: any, index: number) => {
            const jobId = `${analysisId}-${index}`;
            
            return Job.create({
                jobId,
                teamId,
                queueType: 'analysis_processing',
                status: JobStatus.Queued,
                message: trajectoryName,
                metadata: {
                    trajectoryId,
                    analysisId,
                    config,
                    inputFile: item.path || '',
                    timestep: item.timestep ?? item.frame,
                    trajectoryName,
                    modifierId: pluginSlug,
                    plugin: pluginSlug,
                    name: modifierName,
                    totalItems: items.length,
                    itemIndex: index,
                    forEachItem: item,
                    forEachIndex: index
                }
            });
        });
    }
}
