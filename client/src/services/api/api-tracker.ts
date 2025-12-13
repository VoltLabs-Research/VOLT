import api from '@/api';

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
    async getMyStats(params?: GetApiTrackerParams): Promise<ApiTrackerStats> {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.sort) queryParams.append('sort', params.sort);
        if (params?.method) queryParams.append('method', params.method);
        if (params?.statusCode) queryParams.append('statusCode', params.statusCode.toString());

        const response = await api.get<{ status: string; data: ApiTrackerStats }>(
            `/api-tracker/my-stats?${queryParams.toString()}`
        );
        return response.data.data;
    }
};

export default apiTrackerApi;
