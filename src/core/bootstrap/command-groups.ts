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

/**
 * Every command group the daemon serves, named.
 *
 * Groups used to enter a module-level array as a side effect of being imported,
 * and the daemon imported all 233 files under `shared/` and `modules/` at boot to
 * make that happen. The list was complete but invisible: nothing referenced these
 * files, so no tool could tell a live command group from dead code.
 *
 * Adding a group is now two lines — the file, and its name here. That is the
 * whole cost of letting `tsc`, the bundler and "find references" see the wiring.
 */
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
