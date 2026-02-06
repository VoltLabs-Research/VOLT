import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IColorCodingRepository from '../../domain/ports/IColorCodingRepository';
import type {
    ApplyColorCodingInputDTO,
    GetColorCodingPropertiesInputDTO,
    ColorCodingProperties,
    GetColorCodingStatsInputDTO,
    ColorCodingStats
} from '../../application/dtos/color-coding';

@injectable()
export default class ColorCodingRepository extends BaseRepository implements IColorCodingRepository {
    constructor() {
        super('/color-coding', { useRBAC: true });
    }

    async getProperties(params: GetColorCodingPropertiesInputDTO): Promise<ColorCodingProperties> {
        const { trajectoryId, analysisId, timestep } = params;
        const path = analysisId
            ? `/properties/${trajectoryId}/${analysisId}`
            : `/properties/${trajectoryId}`;

        const response = await this.client.get<ApiResponse<ColorCodingProperties>>(path, { timestep });
        return this.unwrap(response);
    }

    async getStats(params: GetColorCodingStatsInputDTO): Promise<ColorCodingStats> {
        const { trajectoryId, analysisId, ...query } = params;
        const path = analysisId
            ? `/stats/${trajectoryId}/${analysisId}`
            : `/stats/${trajectoryId}`;

        const response = await this.client.get<ApiResponse<ColorCodingStats>>(path, query);
        return this.unwrap(response);
    }

    async apply(params: ApplyColorCodingInputDTO): Promise<void> {
        const { trajectoryId, analysisId, timestep, payload } = params;
        const path = analysisId
            ? `/${trajectoryId}/${analysisId}?timestep=${timestep}`
            : `/${trajectoryId}?timestep=${timestep}`;

        await this.client.post(path, payload);
    }
}
