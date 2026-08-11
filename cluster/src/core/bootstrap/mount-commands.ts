import { COMMAND_GROUPS } from '@core/bootstrap/command-groups';
import { registerCommandGroups } from '@shared/commands/CommandRegistry';
import { logger } from '@shared/infrastructure/logger';
import type { CommandTransport } from '@shared/contracts/channel/command-transport';

/**
 * Binds every loaded command group to the transport.
 *
 * This used to import all seventeen groups and list them in a map keyed by
 * module, so a new command group only worked once somebody remembered to edit
 * this file — and the keys stopped being read at all once module gating went
 * away. Groups register themselves as they are imported, so the folder is the
 * contract and nothing here names a module.
 */
const mountCommands = (transport: CommandTransport): void => {
    const startedAt = Date.now();
    const factories = COMMAND_GROUPS;

    registerCommandGroups(factories, transport);

    logger.info(`@command-bootstrap: mounted ${factories.length} command groups durationMs=${Date.now() - startedAt}`);
};

export default mountCommands;
