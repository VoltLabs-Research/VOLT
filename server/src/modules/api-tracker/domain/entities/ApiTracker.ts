export interface ApiTrackerEntity {
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
    url: string;
    userAgent?: string;
    ip: string;
    userId?: string;
    statusCode: number;
    responseTime: number;
    requestBody?: any;
    queryParams?: any;
    headers?: any;
    createdAt: Date;
    updatedAt: Date;
}
