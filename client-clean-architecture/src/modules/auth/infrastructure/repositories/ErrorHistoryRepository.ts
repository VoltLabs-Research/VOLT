import { clearErrorHistory } from '@/shared/infrastructure/api/error-notification';
import type { IErrorHistoryRepository } from '../../domain/repositories/IErrorHistoryRepository';

export class ErrorHistoryRepository implements IErrorHistoryRepository {
    clear(): void {
        clearErrorHistory();
    }
}

export const errorHistoryRepository = new ErrorHistoryRepository();
