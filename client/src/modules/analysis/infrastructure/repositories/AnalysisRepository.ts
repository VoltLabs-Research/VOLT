import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IAnalysisRepository from '../../domain/ports/IAnalysisRepository';
import type { Analysis } from '../../domain/entities';
import type {
    GetAnalysesInputDTO,
    GetAnalysesOutputDTO,
    GetAnalysesByTrajectoryInputDTO,
    GetAnalysesByTrajectoryOutputDTO,
    RetryFailedFramesOutputDTO
} from '../../application/dtos';

@injectable()
export default class AnalysisRepository extends BaseRepository implements IAnalysisRepository {
    constructor() {
        super('/analysis', { useRBAC: true });
    }

    async getAll(params: GetAnalysesInputDTO): Promise<GetAnalysesOutputDTO> {
        return this.getAllPaginated('/', params);
    }

    async getByTrajectoryId(params: GetAnalysesByTrajectoryInputDTO): Promise<GetAnalysesByTrajectoryOutputDTO> {
        const { trajectoryId, page, limit } = params;
        return this.getAllPaginated(`/trajectory/${trajectoryId}`, { page, limit });
    }

    async delete(id: string): Promise<void> {
        await this.client.delete(`/${id}`);
    }

    async retryFailedFrames(id: string): Promise<RetryFailedFramesOutputDTO> {
        const response = await this.client.post<ApiResponse<RetryFailedFramesOutputDTO>>(`/${id}/retry-failed-frames`);
        return this.unwrap(response);
    }
};
