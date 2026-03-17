import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { container } from 'tsyringe';
import type { ITempStorageLifecycleService } from '@shared/domain/port/ITempStorageLifecycleService';

export const startTempStorageLifecycle = async (
    tempStorageLifecycleService: ITempStorageLifecycleService = container.resolve(
        SHARED_TOKENS.TempStorageLifecycleService
    )
): Promise<void> => {
    try {
        await tempStorageLifecycleService.start();
    } catch (error: unknown) {
        logger.warn({ err: error }, '@server: temp storage lifecycle startup cleanup failed');
    }
};
