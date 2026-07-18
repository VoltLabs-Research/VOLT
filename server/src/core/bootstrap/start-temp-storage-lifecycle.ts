import type { ITempStorageLifecycleService } from '@shared/domain/port/ITempStorageLifecycleService';
import logger from '@shared/infrastructure/logger';
import defaultTempStorageLifecycleService from '@shared/infrastructure/services/TempStorageLifecycleService';

export const startTempStorageLifecycle = async (
    tempStorageLifecycleService: ITempStorageLifecycleService = defaultTempStorageLifecycleService
): Promise<void> => {
    try {
        await tempStorageLifecycleService.start();
    } catch {
        logger.warn(`@server: temp storage lifecycle startup cleanup failed`);
    }
};
