import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse, RawPaginatedResponse } from '@/shared/infrastructure/repositories/BaseRepository';
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
        const query: Record<string, unknown> = {
            page: params.page,
            limit: params.limit
        };

        if(params.search) {
            query.q = params.search;
        }

        const raw = await this.client.get<RawPaginatedResponse<Analysis>>('/', query);
        return this.unwrapPaginated(raw);
    }

    async getByTrajectoryId(params: GetAnalysesByTrajectoryInputDTO): Promise<GetAnalysesByTrajectoryOutputDTO> {
        const { trajectoryId, page, limit } = params;
        const raw = await this.client.get<RawPaginatedResponse<Analysis>>(`/trajectory/${trajectoryId}`, { page, limit });
        return this.unwrapPaginated(raw);
    }

    async delete(id: string): Promise<void> {
        await this.client.delete(`/${id}`);
    }

    async retryFailedFrames(id: string): Promise<RetryFailedFramesOutputDTO> {
        const response = await this.client.post<ApiResponse<RetryFailedFramesOutputDTO>>(`/${id}/retry-failed-frames`);
        return this.unwrap(response);
    }
};
