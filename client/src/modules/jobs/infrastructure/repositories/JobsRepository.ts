import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IJobsRepository from '../../domain/port/IJobsRepository';
import type {
    ClearHistoryOutputDTO,
    RemoveRunningJobsOutputDTO,
    RetryFailedJobsOutputDTO
} from '../../application/dtos';

@injectable()
export default class JobsRepository extends BaseRepository implements IJobsRepository {
    constructor() {
        super('/trajectory-jobs', { useRBAC: true });
    }

    async clearHistory(trajectoryId: string): Promise<ClearHistoryOutputDTO> {
        const response = await this.client.post<ApiResponse<ClearHistoryOutputDTO>>(`/${trajectoryId}/clear-history`);
        return this.unwrap(response);
    }

    async removeRunningJobs(trajectoryId: string): Promise<RemoveRunningJobsOutputDTO> {
        const response = await this.client.post<ApiResponse<RemoveRunningJobsOutputDTO>>(`/${trajectoryId}/remove-running`);
        return this.unwrap(response);
    }

    async retryFailedJobs(trajectoryId: string): Promise<RetryFailedJobsOutputDTO> {
        const response = await this.client.post<ApiResponse<RetryFailedJobsOutputDTO>>(`/${trajectoryId}/retry-failed`);
        return this.unwrap(response);
    }
};
