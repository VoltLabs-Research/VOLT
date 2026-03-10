import { IAnalysisJobFactory, AnalysisJobCreateInput } from '@modules/plugin/domain/port/plugin/IAnalysisJobFactory';
import PluginDisplayNameResolver from '@modules/plugin/utilities/plugin/PluginDisplayNameResolver';

import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { injectable } from 'tsyringe';
import { inject } from 'tsyringe';

@injectable()
export default class AnalysisJobFactory implements IAnalysisJobFactory {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService
    ) {}

    create(input: AnalysisJobCreateInput): Job[] {
        const { analysisId, teamId, trajectoryId, trajectoryName, plugin, items, config } = input;
        const pluginId = plugin._id;
        const modifierName = PluginDisplayNameResolver.resolve(plugin.props.workflow, pluginId);

        return items.map((item: Record<string, unknown>, index: number) => {
            const jobId = `${analysisId}-${index}`;
            const timestepValue = item.timestep ?? item.frame;
            const timestep = typeof timestepValue === 'number' || typeof timestepValue === 'string'
                ? String(timestepValue)
                : '';

            if (!timestep) {
                throw new Error(`Missing timestep for analysis job ${jobId}`);
            }

            const inputFile = this.dumpStorage.getObjectName(trajectoryId, timestep);
            
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
                    inputFile,
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
};
