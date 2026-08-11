import logger from '@shared/infrastructure/logger';
import defaultTempStorageLifecycleService, { type TempStorageLifecycleService } from '@shared/infrastructure/services/TempStorageLifecycleService';

export const startTempStorageLifecycle = async (
    tempStorageLifecycleService: TempStorageLifecycleService = defaultTempStorageLifecycleService
): Promise<void> => {
    try {
        await tempStorageLifecycleService.start();
    } catch {
        logger.warn(`@server: temp storage lifecycle startup cleanup failed`);
    }
};
