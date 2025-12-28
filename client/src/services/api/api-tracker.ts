import VoltClient from '@/api';

const client = new VoltClient('/api-tracker');

export interface ApiTrackerRequest {
    _id: string;
    method: string;
    url: string;
    userAgent?: string;
    ip: string;
    statusCode: number;
    responseTime: number;
    createdAt: string;
}

export interface ApiTrackerStats {
    requests: ApiTrackerRequest[];
    summary: {
        totalRequests: number;
        averageResponseTime: number;
        uniqueIPsCount: number;
    };
    statusCodeStats: Array<{ _id: number; count: number }>;
    methodStats: Array<{ _id: string; count: number }>;
}

export interface GetApiTrackerParams {
    limit?: number;
    page?: number;
    sort?: string;
    method?: string;
    statusCode?: number;
}

const apiTrackerApi = {
    async getMyStats(params?: GetApiTrackerParams): Promise<ApiTrackerStats>{
        const response = await client.request<{ status: string; data: ApiTrackerStats }>('get', '/my-stats', { query: params });
        return response.data.data;
    }
};

export default apiTrackerApi;
