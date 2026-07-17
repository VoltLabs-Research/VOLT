export interface EndpointStat {
    method: string;
    path: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
}

export interface StatusCodeStat {
    code: number;
    count: number;
}

export interface PerKeyMetric {
    secretKeyId: string;
    name: string;
    keyPrefix: string;
    roleName: string;
    isActive: boolean;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: string | null;
}

export interface TeamUsageMetrics {
    overview: {
        totalRequests: number;
        successRate: number;
        avgResponseTime: number;
    };
    totalKeys: number;
    activeKeys: number;
    revokedKeys: number;
    perKey: PerKeyMetric[];
    daily: {
        labels: string[];
        total: number[];
        byKey: Record<string, number[]>;
    };
    topEndpoints: EndpointStat[];
}

export interface KeyUsageMetrics {
    key: {
        _id: string;
        name: string;
        keyPrefix: string;
        roleName: string;
        isActive: boolean;
        createdAt: string;
        lastUsedAt: string | null;
    };
    stats: {
        totalRequests: number;
        requests24h: number;
        requests7d: number;
        successRate: number;
        avgResponseTime: number;
        peakHour: string;
    };
    hourly: {
        labels: string[];
        data: number[];
    };
    daily: {
        labels: string[];
        data: number[];
    };
    endpoints: EndpointStat[];
    statusDistribution: StatusCodeStat[];
    recentRequests: {
        method: string;
        path: string;
        statusCode: number;
        responseTime: number;
        ip: string;
        createdAt: string;
    }[];
}
