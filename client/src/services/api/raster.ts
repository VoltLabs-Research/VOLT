import api from '@/api';

interface RasterMetadata {
    trajectoryId: string;
    analysisId: string;
    totalFrames: number;
    [key: string]: any;
}

interface RasterFrameData {
    [key: string]: any;
}

interface ColorCodingStats {
    min: number;
    max: number;
    average: number;
    [key: string]: any;
}

interface ColorCodingPayload {
    property: string;
    colorScheme?: string;
    range?: [number, number];
    startValue?: number;
    endValue?: number;
    gradient?: string;
    exposureId?: string;
}

const rasterApi = {
    async generateGLB(id: string): Promise<any> {
        const response = await api.post<{ status: string; data: any }>(`/raster/${id}/glb/`);
        return response.data.data;
    },

    async getMetadata(id: string): Promise<RasterMetadata> {
        const response = await api.get<{ status: string; data: RasterMetadata }>(`/raster/${id}/metadata`);
        return response.data.data;
    },

    async getFrameData(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<RasterFrameData> {
        const response = await api.get<{ status: string; data: RasterFrameData }>(
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
            await api.post(
                `/color-coding/${trajectoryId}/${analysisId}?timestep=${timestep}`,
                payload
            );
        },

        async getStats(
            trajectoryId: string,
            analysisId: string,
            params?: { timestep?: number; property?: string; type?: string; exposureId?: string }
        ): Promise<ColorCodingStats> {
            const response = await api.get<{ status: string; data: ColorCodingStats }>(
                `/color-coding/stats/${trajectoryId}/${analysisId}`,
                { params }
            );
            return response.data.data;
        },

        async getProperties(
            trajectoryId: string,
            analysisId: string,
            timestep: number
        ): Promise<{ base: string[]; modifiers: Record<string, string[]> }> {
            const response = await api.get<{ status: string; data: { base: string[]; modifiers: Record<string, string[]> } }>(
                `/color-coding/properties/${trajectoryId}/${analysisId}`,
                { params: { timestep } }
            );
            return response.data.data;
        }
    }
};

export default rasterApi;
