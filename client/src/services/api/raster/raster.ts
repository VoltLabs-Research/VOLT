import VoltClient from '@/api';
import type { RasterMetadata, RasterFrameData, ColorCodingPayload, ColorCodingStats } from './types';

const client = new VoltClient('', { useRBAC: true });
const colorCodingClient = new VoltClient('/color-coding', { useRBAC: true });

const rasterApi = {
    async generateGLB(id: string): Promise<any> {
        const response = await client.request<{ status: string; data: any }>('post', `/raster/${id}/glb/`);
        return response.data.data;
    },

    async getMetadata(id: string): Promise<RasterMetadata> {
        const response = await client.request<{ status: string; data: RasterMetadata }>('get', `/raster/${id}/metadata`);
        return response.data.data;
    },

    async getFrameData(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<RasterFrameData> {
        const response = await client.request<{ status: string; data: RasterFrameData }>(
            'get',
            `/raster/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`
        );
        return response.data.data;
    },

    colorCoding: {
        async apply(
            trajectoryId: string,
            analysisId: string,
            timestep: number,
            payload: ColorCodingPayload
        ): Promise<void> {
            await colorCodingClient.request(
                'post',
                `/${trajectoryId}/${analysisId}?timestep=${timestep}`,
                { data: payload }
            );
        },

        async getStats(
            trajectoryId: string,
            analysisId: string,
            params?: { timestep?: number; property?: string; type?: string; exposureId?: string }
        ): Promise<ColorCodingStats> {
            const response = await colorCodingClient.request<{ status: string; data: ColorCodingStats }>(
                'get',
                `/stats/${trajectoryId}/${analysisId}`,
                { query: params }
            );
            return response.data.data;
        },

        async getProperties(
            trajectoryId: string,
            analysisId: string,
            timestep: number
        ): Promise<{ base: string[]; modifiers: Record<string, string[]> }> {
            const response = await colorCodingClient.request<{ status: string; data: { base: string[]; modifiers: Record<string, string[]> } }>(
                'get',
                `/properties/${trajectoryId}/${analysisId}`,
                { query: { timestep } }
            );
            return response.data.data;
        }
    }
};

export default rasterApi;
