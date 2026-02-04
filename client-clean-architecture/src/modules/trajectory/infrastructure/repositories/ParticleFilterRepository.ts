import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IParticleFilterRepository from '../../domain/ports/IParticleFilterRepository';
import type {
    GetFilterPropertiesInputDTO,
    GetFilterPropertiesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO,
    ApplyFilterInputDTO,
    ApplyFilterOutputDTO,
    GetFilteredGlbInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO
} from '../../application/dtos/particle-filter';

@injectable()
export default class ParticleFilterRepository extends BaseRepository implements IParticleFilterRepository{
    constructor(){
        super('/particle-filter', { useRBAC: true });
    }

    async getProperties(params: GetFilterPropertiesInputDTO): Promise<GetFilterPropertiesOutputDTO>{
        const { trajectoryId, analysisId, timestep } = params;
        const response = await this.client.get<ApiResponse<GetFilterPropertiesOutputDTO>>('/properties', {
            trajectoryId,
            analysisId,
            timestep
        });
        return this.unwrap(response);
    }

    async preview(params: PreviewFilterInputDTO): Promise<PreviewFilterOutputDTO>{
        const response = await this.client.post<ApiResponse<PreviewFilterOutputDTO>>('/preview', params);
        return this.unwrap(response);
    }

    async applyAction(params: ApplyFilterInputDTO): Promise<ApplyFilterOutputDTO>{
        const response = await this.client.post<ApiResponse<ApplyFilterOutputDTO>>('/apply', params);
        return this.unwrap(response);
    }

    async getFilteredGlb(params: GetFilteredGlbInputDTO): Promise<Blob>{
        const { trajectoryId, analysisId, fileId } = params;
        return this.client.request<Blob>('GET', `/glb/${trajectoryId}/${analysisId}/${fileId}`, {
            responseType: 'blob'
        });
    }

    async getUniqueValues(params: GetUniqueValuesInputDTO): Promise<GetUniqueValuesOutputDTO>{
        const { trajectoryId, analysisId, ...query } = params;
        const path = analysisId
            ? `/unique-values/${trajectoryId}/${analysisId}`
            : `/unique-values/${trajectoryId}`;
        return this.client.get<GetUniqueValuesOutputDTO>(path, query);
    }
};
