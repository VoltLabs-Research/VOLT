import type { ITempStorageLifecycleService } from '@shared/domain/port/ITempStorageLifecycleService';
import logger from '@shared/infrastructure/logger';
import TempStorageLifecycleService from '@shared/infrastructure/services/TempStorageLifecycleService';
import { container } from 'tsyringe';

export const startTempStorageLifecycle = async (
    tempStorageLifecycleService: ITempStorageLifecycleService = container.resolve(TempStorageLifecycleService)
): Promise<void> => {
    try {
        await tempStorageLifecycleService.start();
    } catch {
        logger.warn(`@server: temp storage lifecycle startup cleanup failed`);
    }
};
