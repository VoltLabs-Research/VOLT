import { injectable } from 'tsyringe';
import { IAnalysisJobFactory, AnalysisJobCreateInput } from '@modules/plugin/domain/port/IAnalysisJobFactory';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import PluginDisplayNameResolver from '@modules/plugin/domain/services/PluginDisplayNameResolver';

@injectable()
export default class AnalysisJobFactory implements IAnalysisJobFactory {
    create(input: AnalysisJobCreateInput): Job[] {
        const { analysisId, teamId, trajectoryId, trajectoryName, plugin, items, config } = input;
        const pluginId = plugin._id;
        const modifierName = PluginDisplayNameResolver.resolve(plugin.props.workflow, pluginId);

        return items.map((item: Record<string, unknown>, index: number) => {
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
                    modifierId: pluginId,
                    plugin: pluginId,
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
