export interface ApiTrackerRequest {
    _id: string;
    method: string;
    url: string;
    path?: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent?: string;
    user?: any;
    team?: any;
    createdAt: string;
}

export interface GetApiTrackerParams {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    method?: string;
    statusCode?: number;
}
