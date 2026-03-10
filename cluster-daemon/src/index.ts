import 'reflect-metadata';
import { bootstrap } from './core/bootstrap';
import { logger } from './core/logger';

bootstrap().catch((error: unknown) => {
    logger.error({ err: error }, 'Failed to start cluster daemon');
    process.exit(1);
});
