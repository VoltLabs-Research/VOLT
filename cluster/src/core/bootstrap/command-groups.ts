import type { CommandGroupFactory } from '@shared/commands/command';
import { getAnalysisCommands } from '@modules/analysis/commands/AnalysisCommands';
import { getDebugCommands } from '@modules/analysis/commands/DebugCommands';
import { getPipelineCommands } from '@modules/analysis/commands/PipelineCommands';
import { getContainerCommands } from '@modules/container/commands/ContainerCommands';
import { getObjectStoreArchiveCommands } from '@modules/container/commands/ObjectStoreArchiveCommands';
import { getRemoteCommands } from '@modules/container/commands/RemoteCommands';
import { getJobsCommands } from '@modules/jobs/commands/JobsCommands';
import { getNotebookCommands } from '@modules/notebook/commands/NotebookCommands';
import { getPluginCommands } from '@modules/plugin/commands/PluginCommands';
import { getRuntimeCommands } from '@modules/system/commands/RuntimeCommands';
import { getTrajectoryCloneCommand } from '@modules/trajectory/commands/TrajectoryCloneCommand';
import { getTrajectoryIngestCommand } from '@modules/trajectory/commands/TrajectoryIngestCommand';
import { getTrajectoryNativeCommands } from '@modules/trajectory/commands/TrajectoryNativeCommands';
import { getTrajectoryPluginCommands } from '@modules/trajectory/commands/TrajectoryPluginCommands';
import { getTrajectoryQueueCommands } from '@modules/trajectory/commands/TrajectoryQueueCommands';

export const COMMAND_GROUPS: readonly CommandGroupFactory[] = [
    getAnalysisCommands,
    getDebugCommands,
    getPipelineCommands,
    getContainerCommands,
    getObjectStoreArchiveCommands,
    getRemoteCommands,
    getJobsCommands,
    getNotebookCommands,
    getPluginCommands,
    getRuntimeCommands,
    getTrajectoryCloneCommand,
    getTrajectoryIngestCommand,
    getTrajectoryNativeCommands,
    getTrajectoryPluginCommands,
    getTrajectoryQueueCommands,
];
