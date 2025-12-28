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

export interface GetApiTrackerParams {
    limit?: number;
    page?: number;
    sort?: string;
    method?: string;
    statusCode?: number;
}

const apiTrackerApi = {
    async getAll(params?: GetApiTrackerParams): Promise<ApiTrackerRequest[]> {
        const response = await client.request<{ status: string; data: ApiTrackerRequest[] }>('get', '/', { query: params });
        return response.data.data;
    }
};

export default apiTrackerApi;
