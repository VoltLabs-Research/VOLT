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
