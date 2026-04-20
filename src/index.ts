import { bootstrap } from '@/app/bootstrap/context';
import { logger } from '@/core/logger';

bootstrap().catch((error) => {
    logger.error(
        `Failed to start cluster daemon: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
});
