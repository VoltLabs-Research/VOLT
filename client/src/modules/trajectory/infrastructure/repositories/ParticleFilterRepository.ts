import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IParticleFilterRepository from '../../domain/port/IParticleFilterRepository';
import type {
    GetFilterPropertiesInputDTO,
    GetFilterPropertiesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO,
    ApplyFilterInputDTO,
    ApplyFilterOutputDTO,
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
        const path = analysisId
            ? `/properties/${trajectoryId}/${analysisId}`
            : `/properties/${trajectoryId}`;
        const response = await this.client.get<ApiResponse<GetFilterPropertiesOutputDTO>>(path, { timestep });
        return this.unwrap(response);
    }

    async preview(params: PreviewFilterInputDTO): Promise<PreviewFilterOutputDTO>{
        const { trajectoryId, analysisId, ...query } = params;
        const path = analysisId
            ? `/preview/${trajectoryId}/${analysisId}`
            : `/preview/${trajectoryId}`;
        const response = await this.client.get<ApiResponse<PreviewFilterOutputDTO>>(path, query);
        return this.unwrap(response);
    }

    async applyAction(params: ApplyFilterInputDTO): Promise<ApplyFilterOutputDTO>{
        const { trajectoryId, analysisId, timestep, action, property, operator, value, exposureId } = params;
        const path = analysisId
            ? `/${trajectoryId}/${analysisId}?timestep=${timestep}&action=${action}`
            : `/${trajectoryId}?timestep=${timestep}&action=${action}`;

        const response = await this.client.post<ApiResponse<ApplyFilterOutputDTO>>(path, {
            property,
            operator,
            value,
            exposureId
        });
        return this.unwrap(response);
    }

    async getUniqueValues(params: GetUniqueValuesInputDTO): Promise<GetUniqueValuesOutputDTO>{
        const { trajectoryId, analysisId, ...query } = params;
        const path = analysisId
            ? `/unique-values/${trajectoryId}/${analysisId}`
            : `/unique-values/${trajectoryId}`;
        const response = await this.client.get<ApiResponse<GetUniqueValuesOutputDTO>>(path, query);
        return this.unwrap(response);
    }
};
