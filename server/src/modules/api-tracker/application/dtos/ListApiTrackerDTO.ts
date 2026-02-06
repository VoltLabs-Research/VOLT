export interface ListApiTrackerInputDTO {
    userId: string;
    page?: number;
    limit?: number;
}

export interface ListApiTrackerOutputDTO {
    items: {
        id: string;
        method: string;
        url: string;
        userAgent?: string;
        ip: string;
        statusCode: number;
        responseTime: number;
        requestBody?: any;
        queryParams?: any;
        headers?: any;
        createdAt: Date;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
