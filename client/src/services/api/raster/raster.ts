import VoltClient from '@/api';
import type { RasterMetadata, RasterFrameData, ColorCodingPayload, ColorCodingStats, ColorCodingProperties } from './types';
import type { ApiResponse } from '@/types/api';

const client = new VoltClient('/raster', { useRBAC: true });
const colorCodingClient = new VoltClient('/color-coding', { useRBAC: true });

const rasterApi = {
    async generateGLB(id: string): Promise<any> {
        const response = await client.request('post', `/${id}/glb/`);
        return response.data.data;
    },

    async getMetadata(id: string): Promise<RasterMetadata> {
        const response = await client.request<ApiResponse<RasterMetadata>>('get', `/${id}/metadata`);
        return response.data.data;
    },

    async getFrameData(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<RasterFrameData> {
        const response = await client.request<ApiResponse<RasterFrameData>>(
            'get',
            `/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`
        );
        return response.data.data;
    },

    colorCoding: {
        async apply(
            trajectoryId: string,
            analysisId: string | undefined,
            timestep: number,
            payload: ColorCodingPayload
        ): Promise<void> {
            const path = analysisId
                ? `/${trajectoryId}/${analysisId}?timestep=${timestep}`
                : `/${trajectoryId}?timestep=${timestep}`;
            await colorCodingClient.request(
                'post',
                path,
                { data: payload }
            );
        },

        async getStats(
            trajectoryId: string,
            analysisId: string | undefined,
            params?: { timestep?: number; property?: string; type?: string; exposureId?: string }
        ): Promise<ColorCodingStats> {
            const path = analysisId
                ? `/stats/${trajectoryId}/${analysisId}`
                : `/stats/${trajectoryId}`;
            const response = await colorCodingClient.request<ApiResponse<ColorCodingStats>>(
                'get',
                path,
                { query: params }
            );
            return response.data.data;
        },

        async getProperties(
            trajectoryId: string,
            analysisId: string | undefined,
            timestep: number
        ): Promise<{ base: string[]; modifiers: Record<string, string[]> }> {
            const path = analysisId
                ? `/properties/${trajectoryId}/${analysisId}`
                : `/properties/${trajectoryId}`;
            const response = await colorCodingClient.request<ApiResponse<ColorCodingProperties>>(
                'get',
                path,
                { query: { timestep } }
            );
            return response.data.data;
        }
    }
};

export default rasterApi;
