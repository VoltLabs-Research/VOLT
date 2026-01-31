import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ITrajectoryJobsRepository from '../../domain/ports/ITrajectoryJobsRepository';
import type {
    ClearHistoryOutputDTO,
    RemoveRunningJobsOutputDTO,
    RetryFailedJobsOutputDTO
} from '../../application/dtos/jobs';

@injectable()
export default class TrajectoryJobsRepository extends BaseRepository implements ITrajectoryJobsRepository{
    constructor(){
        super('/trajectory-jobs', { useRBAC: true });
    }

    async clearHistory(trajectoryId: string): Promise<ClearHistoryOutputDTO>{
        const response = await this.client.post<ApiResponse<ClearHistoryOutputDTO>>(`/${trajectoryId}/clear-history`);
        return this.unwrap(response);
    }

    async removeRunningJobs(trajectoryId: string): Promise<RemoveRunningJobsOutputDTO>{
        const response = await this.client.post<ApiResponse<RemoveRunningJobsOutputDTO>>(`/${trajectoryId}/remove-running`);
        return this.unwrap(response);
    }

    async retryFailedJobs(trajectoryId: string): Promise<RetryFailedJobsOutputDTO>{
        const response = await this.client.post<ApiResponse<RetryFailedJobsOutputDTO>>(`/${trajectoryId}/retry-failed`);
        return this.unwrap(response);
    }
};
