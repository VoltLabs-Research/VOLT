import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import VoltClient from '@/shared/infrastructure/api';
import type { ApiResponse } from '@/shared/types/api';
import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';
import type {
    RasterMetadata,
    RasterFrameData,
    ColorCodingPayload,
    ColorCodingStats,
    ColorCodingProperties
} from '../../domain/entities';

export class RasterRepository extends BaseRepository implements IRasterRepository {
    private readonly colorCodingClient: VoltClient;

    constructor() {
        super('/raster', { useRBAC: true });
        this.colorCodingClient = new VoltClient('/color-coding', { useRBAC: true });
    }

    async generateGLB(id: string): Promise<any> {
        return this.post<any>(`/${id}/glb/`);
    }

    async getMetadata(id: string): Promise<RasterMetadata> {
        return this.get<RasterMetadata>(`/${id}/metadata`);
    }

    async getFrameData(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<RasterFrameData> {
        return this.get<RasterFrameData>(`/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`);
    }

    async applyColorCoding(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: number,
        payload: ColorCodingPayload
    ): Promise<void> {
        const path = analysisId
            ? `/${trajectoryId}/${analysisId}`
            : `/${trajectoryId}`;
        await this.colorCodingClient.request(
            'post',
            path,
            { 
                data: payload,
                query: { timestep }
            }
        );
    }

    async getColorCodingStats(
        trajectoryId: string,
        analysisId: string | undefined,
        params?: { timestep?: number; property?: string; type?: string; exposureId?: string }
    ): Promise<ColorCodingStats> {
        const path = analysisId
            ? `/stats/${trajectoryId}/${analysisId}`
            : `/stats/${trajectoryId}`;
        const response = await this.colorCodingClient.request<ApiResponse<ColorCodingStats>>(
            'get',
            path,
            { query: params }
        );
        return response.data.data;
    }

    async getColorCodingProperties(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: number
    ): Promise<ColorCodingProperties> {
        const path = analysisId
            ? `/properties/${trajectoryId}/${analysisId}`
            : `/properties/${trajectoryId}`;
        const response = await this.colorCodingClient.request<ApiResponse<ColorCodingProperties>>(
            'get',
            path,
            { query: { timestep } }
        );
        return response.data.data;
    }
}

export const rasterRepository = new RasterRepository();
