import { COMMAND_GROUPS } from '@core/bootstrap/command-groups';
import { registerCommandGroups } from '@shared/commands/CommandRegistry';
import { logger } from '@shared/infrastructure/logger';
import type { CommandTransport } from '@shared/contracts/channel/command-transport';

const mountCommands = (transport: CommandTransport): void => {
    const startedAt = Date.now();
    const factories = COMMAND_GROUPS;

    registerCommandGroups(factories, transport);

    logger.info(`@command-bootstrap: mounted ${factories.length} command groups durationMs=${Date.now() - startedAt}`);
};

export default mountCommands;
