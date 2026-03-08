interface EndpointStat {
    method: string;
    path: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
};

interface StatusCodeStat {
    code: number;
    count: number;
};

interface PerKeyMetric {
    secretKeyId: string;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
};

export interface TeamUsageMetrics {
    overview: {
        totalRequests: number;
        successRate: number;
        avgResponseTime: number;
    };
    perKey: PerKeyMetric[];
    daily: {
        labels: string[];
        total: number[];
        byKey: Record<string, number[]>;
    };
    topEndpoints: EndpointStat[];
};

export interface KeyUsageMetrics {
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
        createdAt: Date;
    }[];
};
