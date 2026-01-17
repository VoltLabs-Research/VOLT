import { ApiTrackerEntity } from '../entities/ApiTracker';

export interface IApiTrackerRepository {
    findByUserId(userId: string, page: number, limit: number): Promise<{ items: ApiTrackerEntity[]; total: number }>;
    deleteByUserId(userId: string): Promise<void>;
}
