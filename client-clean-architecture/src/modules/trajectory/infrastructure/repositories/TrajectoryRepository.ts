import { injectable, inject } from 'tsyringe';
import BaseRepository, { ApiResponse, PaginatedApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import { base64ToBlobUrl } from '@/shared/utils/file';
import type ITrajectoryRepository from '../../domain/ports/ITrajectoryRepository';
import type IPreviewCache from '../../domain/ports/IPreviewCache';
import type { Trajectory } from '../../domain/entities';
import type {
    GetTrajectoriesInputDTO,
    GetTrajectoriesOutputDTO,
    CreateTrajectoryOutputDTO,
    GetPreviewInputDTO,
    GetPreviewOutputDTO,
    DownloadTrajectoryInputDTO,
    GetAtomsInputDTO,
    GetAtomsOutputDTO
} from '../../application/dtos/trajectory';
import { TRAJECTORY_TOKENS } from '../di/tokens';

@injectable()
export default class TrajectoryRepository extends BaseRepository implements ITrajectoryRepository{
    constructor(
        @inject(TRAJECTORY_TOKENS.PreviewCache)
        private readonly previewCache: IPreviewCache
    ){
        super('/trajectory', { useRBAC: true });
    }

    async getAll(params: GetTrajectoriesInputDTO = {}): Promise<GetTrajectoriesOutputDTO>{
        const response = await this.client.get<PaginatedApiResponse<Trajectory>>('/', params);
        return {
            trajectories: response.data,
            total: response.total,
            page: response.page,
            limit: response.limit,
            hasMore: response.page * response.limit < response.total
        };
    }

    async getById(id: string): Promise<Trajectory>{
        const response = await this.client.get<ApiResponse<Trajectory>>(`/${id}`);
        return this.unwrap(response);
    }

    async create(formData: FormData, onProgress?: (progress: number) => void): Promise<CreateTrajectoryOutputDTO>{
        const response = await this.client.request<ApiResponse<Trajectory>>('POST', '/', {
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: onProgress ? (e) => {
                if(e.total){
                    onProgress(e.loaded / e.total);
                }
            } : undefined
        });
        return { trajectory: this.unwrap(response) };
    }

    async update(id: string, data: Partial<Trajectory>): Promise<Trajectory>{
        const response = await this.client.patch<ApiResponse<Trajectory>>(`/${id}`, data);
        return this.unwrap(response);
    }

    async delete(id: string): Promise<void>{
        await this.client.delete<ApiResponse<void>>(`/${id}`);
    }

    async getPreview(params: GetPreviewInputDTO): Promise<GetPreviewOutputDTO>{
        const { trajectoryId, version, ...query } = params;
        const cacheVersion = version ?? '';

        if(this.previewCache.has(trajectoryId, cacheVersion)){
            const cached = this.previewCache.get(trajectoryId);
            if(cached){
                return { blobUrl: cached.blobUrl };
            }
        }

        const response = await this.client.get<ApiResponse<{ preview: string }>>(`/${trajectoryId}/preview`, query);
        const base64 = this.unwrap(response).preview;
        const blobUrl = base64ToBlobUrl(base64);

        this.previewCache.set(trajectoryId, blobUrl, cacheVersion);

        return { blobUrl };
    }

    invalidatePreviewCache(trajectoryId: string): void{
        this.previewCache.delete(trajectoryId);
    }

    async download(params: DownloadTrajectoryInputDTO): Promise<Blob>{
        const { trajectoryId, filename } = params;
        const queryParams = filename ? { name: filename } : {};
        return this.client.request<Blob>('GET', `/${trajectoryId}/download`, {
            query: queryParams,
            responseType: 'blob'
        });
    }

    async getMetrics(): Promise<Record<string, unknown>>{
        const response = await this.client.get<ApiResponse<Record<string, unknown>>>('/metrics');
        return this.unwrap(response);
    }

    async listSamples(): Promise<string[]>{
        const response = await this.client.get<ApiResponse<string[]>>('/samples');
        return this.unwrap(response);
    }

    async downloadSample(filename: string): Promise<Blob>{
        return this.client.request<Blob>('GET', `/samples/${filename}`, {
            responseType: 'blob'
        });
    }

    async getAtoms(params: GetAtomsInputDTO): Promise<GetAtomsOutputDTO>{
        const { trajectoryId, analysisId, ...query } = params;
        const response = await this.client.get<ApiResponse<GetAtomsOutputDTO>>(`/${trajectoryId}/atoms`, {
            analysisId,
            ...query
        });
        return this.unwrap(response);
    }
};
