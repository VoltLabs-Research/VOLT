import type { ApiTrackerRequest, GetApiTrackerParams } from '../entities';

export interface IApiTrackerRepository {
    getAll(params?: GetApiTrackerParams): Promise<ApiTrackerRequest[]>;
}
