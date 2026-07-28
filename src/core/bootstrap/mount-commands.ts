import { getEnabledModules } from '@core/bootstrap/module-state';
import { getCommandRegistry, type CommandGroupBinding } from '@shared/commands/CommandRegistry';
import { logger } from '@shared/infrastructure/logger';
import type { ReverseChannelBridge } from '@modules/container/socket/ReverseChannelBridge';

import { AnalysisCommands, getAnalysisCommands } from '@modules/analysis/commands/AnalysisCommands';
import { DebugCommands, getDebugCommands } from '@modules/analysis/commands/DebugCommands';
import { PipelineCommands, getPipelineCommands } from '@modules/analysis/commands/PipelineCommands';
import { ContainerCommands, getContainerCommands } from '@modules/container/commands/ContainerCommands';
import { ObjectStoreArchiveCommands, getObjectStoreArchiveCommands } from '@modules/container/commands/ObjectStoreArchiveCommands';
import { RemoteCommands, getRemoteCommands } from '@modules/container/commands/RemoteCommands';
import { JobsCommands, getJobsCommands } from '@modules/jobs/commands/JobsCommands';
import { QueueCommands, getQueueCommands } from '@modules/jobs/commands/QueueCommands';
import { NotebookCommands, getNotebookCommands } from '@modules/notebook/commands/NotebookCommands';
import { PluginCommands, getPluginCommands } from '@modules/plugin/commands/PluginCommands';
import { RuntimeCommands, getRuntimeCommands } from '@modules/system/commands/RuntimeCommands';
import { TrajectoryCloneCommand, getTrajectoryCloneCommand } from '@modules/trajectory/commands/TrajectoryCloneCommand';
import { TrajectoryIngestCommand, getTrajectoryIngestCommand } from '@modules/trajectory/commands/TrajectoryIngestCommand';
import { TrajectoryNativeCommands, getTrajectoryNativeCommands } from '@modules/trajectory/commands/TrajectoryNativeCommands';
import { TrajectoryParquetIngestCommand, getTrajectoryParquetIngestCommand } from '@modules/trajectory/commands/TrajectoryParquetIngestCommand';
import { TrajectoryPluginCommands, getTrajectoryPluginCommands } from '@modules/trajectory/commands/TrajectoryPluginCommands';
import { TrajectoryQueueCommands, getTrajectoryQueueCommands } from '@modules/trajectory/commands/TrajectoryQueueCommands';

const COMMAND_GROUPS: readonly CommandGroupBinding[] = [
    { moduleKey: 'system', group: RuntimeCommands, resolve: () => getRuntimeCommands() as never },
    { moduleKey: 'container', group: ContainerCommands, resolve: () => getContainerCommands() as never },
    { moduleKey: 'container', group: ObjectStoreArchiveCommands, resolve: () => getObjectStoreArchiveCommands() as never },
    { moduleKey: 'container', group: RemoteCommands, resolve: () => getRemoteCommands() as never },
    { moduleKey: 'jobs', group: JobsCommands, resolve: () => getJobsCommands() as never },
    { moduleKey: 'jobs', group: QueueCommands, resolve: () => getQueueCommands() as never },
    { moduleKey: 'plugin', group: PluginCommands, resolve: () => getPluginCommands() as never },
    { moduleKey: 'trajectory', group: TrajectoryCloneCommand, resolve: () => getTrajectoryCloneCommand() as never },
    { moduleKey: 'trajectory', group: TrajectoryIngestCommand, resolve: () => getTrajectoryIngestCommand() as never },
    { moduleKey: 'trajectory', group: TrajectoryNativeCommands, resolve: () => getTrajectoryNativeCommands() as never },
    { moduleKey: 'trajectory', group: TrajectoryParquetIngestCommand, resolve: () => getTrajectoryParquetIngestCommand() as never },
    { moduleKey: 'trajectory', group: TrajectoryPluginCommands, resolve: () => getTrajectoryPluginCommands() as never },
    { moduleKey: 'trajectory', group: TrajectoryQueueCommands, resolve: () => getTrajectoryQueueCommands() as never },
    { moduleKey: 'analysis', group: AnalysisCommands, resolve: () => getAnalysisCommands() as never },
    { moduleKey: 'analysis', group: DebugCommands, resolve: () => getDebugCommands() as never },
    { moduleKey: 'analysis', group: PipelineCommands, resolve: () => getPipelineCommands() as never },
    { moduleKey: 'notebook', group: NotebookCommands, resolve: () => getNotebookCommands() as never }
];

const mountCommands = (reverseChannelBridge: ReverseChannelBridge): void => {
    const startedAt = Date.now();
    const enabled = getEnabledModules();
    const bindings = COMMAND_GROUPS.filter((binding) => enabled.has(binding.moduleKey));

    getCommandRegistry().registerGroups(bindings, reverseChannelBridge);

    logger.info(`@command-bootstrap: mounted ${bindings.length}/${COMMAND_GROUPS.length} command groups durationMs=${Date.now() - startedAt}`);
};

export default mountCommands;
