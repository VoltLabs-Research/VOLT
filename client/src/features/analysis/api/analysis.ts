import VoltClient from '@/api';
import type { AnalysisConfig } from '@/features/analysis/api/types';
import type { PaginatedResponse } from '@/types/api';

const client = new VoltClient('/analyses', { useRBAC: true });

export interface RetryFailedFramesResponse {
    message: string;
    retriedFrames: number;
    totalFrames: number;
    failedTimesteps?: number[];
}

export default {
    async getByTeamId(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedResponse<AnalysisConfig>> {
        const response = await client.request('get', '/', { query: params });
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await client.request('delete', `/${id}`);
    },

    async retryFailedFrames(id: string): Promise<RetryFailedFramesResponse> {
        const response = await client.request('post', `/${id}/retry-failed-frames`);
        return response.data.data;
    }
};