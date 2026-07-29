import { getEnabledModules } from '@core/bootstrap/module-state';
import { getCommandRegistry } from '@shared/commands/CommandRegistry';
import { logger } from '@shared/infrastructure/logger';
import type { CommandGroupFactory } from '@shared/commands/command';
import type { CommandTransport } from '@shared/contracts/channel/command-transport';

import { getAnalysisCommands } from '@modules/analysis/commands/AnalysisCommands';
import { getDebugCommands } from '@modules/analysis/commands/DebugCommands';
import { getPipelineCommands } from '@modules/analysis/commands/PipelineCommands';
import { getContainerCommands } from '@modules/container/commands/ContainerCommands';
import { getObjectStoreArchiveCommands } from '@modules/container/commands/ObjectStoreArchiveCommands';
import { getRemoteCommands } from '@modules/container/commands/RemoteCommands';
import { getJobsCommands } from '@modules/jobs/commands/JobsCommands';
import { getQueueCommands } from '@modules/jobs/commands/QueueCommands';
import { getNotebookCommands } from '@modules/notebook/commands/NotebookCommands';
import { getPluginCommands } from '@modules/plugin/commands/PluginCommands';
import { getRuntimeCommands } from '@modules/system/commands/RuntimeCommands';
import { getTrajectoryCloneCommand } from '@modules/trajectory/commands/TrajectoryCloneCommand';
import { getTrajectoryIngestCommand } from '@modules/trajectory/commands/TrajectoryIngestCommand';
import { getTrajectoryNativeCommands } from '@modules/trajectory/commands/TrajectoryNativeCommands';
import { getTrajectoryParquetIngestCommand } from '@modules/trajectory/commands/TrajectoryParquetIngestCommand';
import { getTrajectoryPluginCommands } from '@modules/trajectory/commands/TrajectoryPluginCommands';
import { getTrajectoryQueueCommands } from '@modules/trajectory/commands/TrajectoryQueueCommands';

const COMMAND_GROUPS: Readonly<Record<string, readonly CommandGroupFactory[]>> = {
    system: [getRuntimeCommands],
    container: [getContainerCommands, getObjectStoreArchiveCommands, getRemoteCommands],
    jobs: [getJobsCommands, getQueueCommands],
    plugin: [getPluginCommands],
    trajectory: [
        getTrajectoryCloneCommand,
        getTrajectoryIngestCommand,
        getTrajectoryNativeCommands,
        getTrajectoryParquetIngestCommand,
        getTrajectoryPluginCommands,
        getTrajectoryQueueCommands
    ],
    analysis: [getAnalysisCommands, getDebugCommands, getPipelineCommands],
    notebook: [getNotebookCommands]
};

const mountCommands = (transport: CommandTransport): void => {
    const startedAt = Date.now();
    const enabled = getEnabledModules();

    const entries = Object.entries(COMMAND_GROUPS);
    const factories = entries
        .filter(([moduleKey]) => enabled.has(moduleKey))
        .flatMap(([, groups]) => groups);
    const total = entries.reduce((count, [, groups]) => count + groups.length, 0);

    getCommandRegistry().registerGroups(factories, transport);

    logger.info(`@command-bootstrap: mounted ${factories.length}/${total} command groups durationMs=${Date.now() - startedAt}`);
};

export default mountCommands;
